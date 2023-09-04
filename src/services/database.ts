import {addRxPlugin, createRxDatabase, lastOfArray, RxCollection, RxDatabase} from "rxdb";
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {RxDBDevModePlugin} from 'rxdb/plugins/dev-mode';
import {HttpAgent} from "@dfinity/agent";
import {createActor as createDbActor} from "../declarations/db";
import {replicateRxCollection} from "rxdb/plugins/replication";
import {TodoListItemDoc} from "../declarations/db/db.did";
import {BehaviorSubject, Observable} from "rxjs";

addRxPlugin(RxDBDevModePlugin);

export type TodoListItemDocument = { id: string; updatedAt: number, text: string; isChecked: number; deleted: boolean };

export default class DB {

    private static _instance: DB | undefined;
    public static get instance(): DB {
        if (!this._instance) {
            this._instance = new DB();
        }
        return this._instance;
    }

    private db?: RxDatabase;

    private pulling$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private pushing$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    subscribeOnPulling(): Observable<boolean> {
        return this.pulling$.asObservable();
    }

    subscribeOnPushing(): Observable<boolean> {
        return this.pushing$.asObservable();
    }

    private constructor() {
        this.init = this.initializeDatabase().then(this.init = undefined);
    }

    private init: Promise<void> | undefined;

    private async initializeDatabase() {
        try {
            const db = await createRxDatabase({
                name: 'todolist',
                storage: getRxStorageDexie(),
                ignoreDuplicate: true,
                multiInstance: true,
                eventReduce: true,
                cleanupPolicy: {},
            });
            const {todos} = await db.addCollections({
                todos: {
                    schema: {
                        type: "object",
                        version: 0,
                        primaryKey: "id",
                        properties: {
                            id: {type: "string", maxLength: 100},
                            updatedAt: {type: "number", multipleOf: 1, minimum: 0, maximum: (1 << 16) * (1 << 16) - 1},
                            text: {type: "string", maxLength: 256, default: ''},
                            isChecked: {type: "number", multipleOf: 1, minimum: 0, maximum: 1, default: 0},
                        },
                        required: ["id", "updatedAt", "text", "isChecked"],
                        indexes: ["updatedAt", "isChecked"],
                    },
                },
            });
            this.db = db;
            console.log('Database initialized successfully');

            const agent = new HttpAgent({
                host: process.env.DFX_NETWORK === 'ic' ? 'https://ic0.app' : 'http://127.0.0.1:4943',
                retryTimes: 5,
            });
            if (process.env.DFX_NETWORK === 'local') {
                await agent.fetchRootKey();
            }
            const can = createDbActor(process.env.DB_CANISTER_ID!, {agent});
            const replicationState = await replicateRxCollection({
                collection: todos,
                replicationIdentifier: 'anything',
                retryTime: 5 * 1000,
                autoStart: true,
                deletedField: 'deleted',
                push: {
                    handler: async (docs): Promise<any> => {
                        this.pushing$.next(true);
                        let store: TodoListItemDocument[] = docs.map(x => x.newDocumentState) as any;
                        try {
                            const arg = store.map(x => ({
                                id: BigInt(x.id),
                                updatedAt: Math.floor(Date.now() / 1000),
                                isChecked: x.isChecked > 0,
                                text: x.text,
                                deleted: x.deleted,
                            }));
                            const res = await can.push(arg);
                            this.pushing$.next(false);
                            return res;
                        } catch (err) {
                            this.pushing$.next(false);
                            console.error(err);
                            throw err;
                        }
                    },

                    batchSize: 100,

                    modifier: (d) => d,
                },

                pull: {
                    handler: async (lastCheckpoint: any, batchSize): Promise<any> => {
                        this.pulling$.next(true);
                        const minTimestamp = lastCheckpoint ? lastCheckpoint.updatedAt : 0;
                        const lastId: [] | [bigint] = lastCheckpoint ? [BigInt(lastCheckpoint.id)] : [];
                        try {
                            let raw: TodoListItemDoc[] = (await can.pull(minTimestamp, lastId, BigInt(batchSize)));
                            const documentsFromRemote: TodoListItemDocument[] = raw.map(x => ({
                                ...x,
                                id: x.id.toString(),
                                isChecked: x.isChecked ? 1 : 0,
                            }));
                            this.pulling$.next(false);
                            return {
                                documents: documentsFromRemote,
                                checkpoint:
                                    documentsFromRemote.length === 0
                                        ? lastCheckpoint
                                        : {
                                            id: lastOfArray(documentsFromRemote)!.id,
                                            updatedAt: lastOfArray(documentsFromRemote)!.updatedAt,
                                        },
                            };
                        } catch (err) {
                            this.pulling$.next(false);
                            console.error(err);
                            throw err;
                        }
                    },
                    batchSize: 1000,
                    modifier: (d) => d,
                },
            });
            setInterval(() => replicationState.reSync(), 15000);
        } catch (error) {
            console.error('Error initializing the database:', error);
        }
    }

    public async getTodo(): Promise<RxCollection<TodoListItemDocument>> {
        if (!this.db) {
            await this.init;
        }
        return this.db!.todos;
    }
}
