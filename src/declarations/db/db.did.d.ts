import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface ItemDoc {
  'id' : bigint,
  'deleted' : boolean,
  'updatedAt' : number,
  'payload' : TodoListItemV1,
}
export interface TodoListDb {
  'dump' : ActorMethod<[], Array<[Principal, Array<[] | [ItemDoc]>]>>,
  'pull' : ActorMethod<[number, [] | [bigint], bigint], Array<ItemDoc>>,
  'push' : ActorMethod<[Array<ItemDoc>], Array<ItemDoc>>,
}
export interface TodoListItemV1 { 'isChecked' : boolean, 'text' : string }
export interface _SERVICE extends TodoListDb {}
