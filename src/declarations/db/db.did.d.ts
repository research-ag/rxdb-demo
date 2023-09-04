import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface TodoListDb {
  'pull' : ActorMethod<[number, [] | [bigint], bigint], Array<TodoListItemDoc>>,
  'push' : ActorMethod<[Array<TodoListItemDoc>], Array<TodoListItemDoc>>,
}
export interface TodoListItemDoc {
  'id' : bigint,
  'deleted' : boolean,
  'isChecked' : boolean,
  'text' : string,
  'updatedAt' : number,
}
export interface _SERVICE extends TodoListDb {}
