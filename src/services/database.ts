import {addRxPlugin, createRxDatabase, lastOfArray, RxCollection, RxDatabase} from "rxdb";
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {HttpAgent, Identity} from "@dfinity/agent";
import {createActor as createDbActor} from "../declarations/db";
import {replicateRxCollection, RxReplicationState} from "rxdb/plugins/replication";
import {ItemDoc} from "../declarations/db/db.did";
import {BehaviorSubject, Observable} from "rxjs";
import {RxDBMigrationPlugin} from 'rxdb/plugins/migration';

import {RxDBDevModePlugin} from 'rxdb/plugins/dev-mode';

addRxPlugin(RxDBDevModePlugin);

addRxPlugin(RxDBMigrationPlugin);

export type TodoListItemDocument = {
    id: string;
    updatedAt: number,
    deleted: boolean,
    payload: {
        text: string,
        isChecked: boolean,
        isImportant: boolean,
    }
};

export default class DB {

    private db?: RxDatabase;
    private replicationState?: RxReplicationState<any, any>;
    private pullInterval?: any;

    private pulling$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private pushing$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private init: Promise<void> | undefined;

    subscribeOnPulling(): Observable<boolean> {
        return this.pulling$.asObservable();
    }

    subscribeOnPushing(): Observable<boolean> {
        return this.pushing$.asObservable();
    }

    public async getTodo(): Promise<RxCollection<TodoListItemDocument>> {
        if (!this.db) {
            await this.init;
        }
        return this.db!.todos;
    }

    constructor(private readonly identity: Identity) {
        this.init = this.initializeDatabase(this.identity).then(this.init = undefined);
    }

    private async initializeDatabase(identity: Identity) {
        try {
            const db = await createRxDatabase({
                name: 'todolist_' + identity.getPrincipal().toText(),
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
                        version: 1,
                        primaryKey: "id",
                        properties: {
                            id: {type: "string", maxLength: 100},
                            updatedAt: {type: "number", multipleOf: 1, minimum: 0, maximum: (1 << 16) * (1 << 16) - 1},
                            payload: {
                                type: "record",
                                properties: {
                                    text: {type: "string", maxLength: 256},
                                    isChecked: {type: "boolean"},
                                    isImportant: {type: "boolean"},
                                },
                                required: ["text", "isChecked", "isImportant"],
                            }
                        },
                        required: ["id", "updatedAt", "payload"],
                        indexes: ["updatedAt"],
                    },
                    migrationStrategies: {
                        1: (oldDoc) => {
                            oldDoc.payload.isImportant = false;
                            return oldDoc;
                        },
                    }
                },
            });
            this.db = db;
            console.log('Database initialized successfully');

            const agent = new HttpAgent({
                host: process.env.DFX_NETWORK === 'ic' ? 'https://ic0.app' : 'http://127.0.0.1:4943',
                retryTimes: 5,
                identity,
            });
            if (process.env.DFX_NETWORK === 'local') {
                await agent.fetchRootKey();
            }
            const can = createDbActor(process.env.DB_CANISTER_ID!, {agent});
            this.replicationState = replicateRxCollection({
                collection: todos,
                replicationIdentifier: 'todo-' + identity.getPrincipal().toText(),
                retryTime: 5 * 1000,
                autoStart: false,
                deletedField: 'deleted',
                push: {
                    handler: async (docs): Promise<any> => {
                        this.pushing$.next(true);
                        let store: TodoListItemDocument[] = docs.map(x => x.newDocumentState) as any;
                        try {
                            const arg = store.map(x => ({
                                id: BigInt(x.id),
                                updatedAt: Math.floor(Date.now() / 1000),
                                payload: x.payload,
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
                            let raw: ItemDoc[] = (await can.pull(minTimestamp, lastId, BigInt(batchSize)));
                            const documentsFromRemote: TodoListItemDocument[] = raw.map(x => ({
                                ...x,
                                id: x.id.toString(),
                                text: x.payload.text,
                                isChecked: x.payload.isChecked,
                                isImportant: x.payload.isImportant,
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
            this.replicationState.start().then();
            this.pullInterval = setInterval(() => this.replicationState!.reSync(), 15000);
        } catch (error) {
            console.error('Error initializing the database:', error);
        }
    }

    public stop() {
        if (this.pullInterval !== undefined) {
            clearInterval(this.pullInterval);
        }
        if (this.replicationState) {
            this.replicationState.cancel();
        }
    }

    public refresh() {
        if (this.replicationState) {
            this.replicationState.reSync();
        }
    }
}
