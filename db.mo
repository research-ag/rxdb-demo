import Array "mo:base/Array";
import Debug "mo:base/Debug";
import List "mo:base/List";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Vector "mo:vector";

import RXMDB "mo:rxmodb";
import PK "mo:rxmodb/primarykey";
import IDX "mo:rxmodb/index";

module RxDbTable {

  public func migrate<T1, T2>(src : DbInit<T1>, cast : (x : T1) -> T2) : DbInit<T2> = {
    db = {
      var reuse_queue = src.db.reuse_queue;
      vec = Vector.map<?ItemDoc<T1>, ?ItemDoc<T2>>(
        src.db.vec,
        func(x) = switch (x) {
          case (?item) ?{
            id = item.id;
            updatedAt = item.updatedAt;
            deleted = item.deleted;
            payload = cast(item.payload);
          };
          case (null) null;
        },
      );
    };
    pk = src.pk;
    updatedAt = src.updatedAt;
  };

  public type ItemDoc<T> = {
    id : Nat64;
    updatedAt : Nat32;
    deleted : Bool;
    payload : T;
  };

  public type DbInit<T> = {
    db : RXMDB.RXMDB<ItemDoc<T>>;
    pk : PK.Init<Nat64>;
    updatedAt : IDX.Init<Nat64>;
  };

  public type DbUse<T> = {
    db : RXMDB.Use<ItemDoc<T>>;
    pk : PK.Use<Nat64, ItemDoc<T>>;
    updatedAt : IDX.Use<Nat64, ItemDoc<T>>;
  };

  public func empty<T>() : DbInit<T> = {
    db = RXMDB.init<ItemDoc<T>>();
    pk = PK.init<Nat64>(?32);
    updatedAt = IDX.init<Nat64>(?32);
  };

  public func use<T>(init : DbInit<T>) : DbUse<T> {
    let obs = RXMDB.init_obs<ItemDoc<T>>();
    // PK
    let pk_config : PK.Config<Nat64, ItemDoc<T>> = {
      db = init.db;
      obs;
      store = init.pk;
      compare = Nat64.compare;
      key = func(d : ItemDoc<T>) = d.id;
      regenerate = #no;
    };
    PK.Subscribe<Nat64, ItemDoc<T>>(pk_config);

    let updatedAt_config : IDX.Config<Nat64, ItemDoc<T>> = {
      db = init.db;
      obs;
      store = init.updatedAt;
      compare = Nat64.compare;
      key = func(idx : Nat, d : ItemDoc<T>) = ?((Nat64.fromNat(Nat32.toNat(d.updatedAt)) << 32) | Nat64.fromNat(idx));
      regenerate = #no;
      keep = #all;
    };
    IDX.Subscribe(updatedAt_config);

    return {
      db = RXMDB.Use<ItemDoc<T>>(init.db, obs);
      pk = PK.Use(pk_config);
      updatedAt = IDX.Use(updatedAt_config);
    };
  };

  public func pushUpdates<T>(use : DbUse<T>, docs : [ItemDoc<T>]) : [ItemDoc<T>] {
    // var conflicts : Vector.Vector<TodoListItemDoc> = Vector.new();
    for (doc in docs.vals()) {
      use.db.insert(doc);
      // let ?rec = callerDb.pk.get(doc.id) else Debug.trap("Not found");
      // if (rec.revision != doc.revision + 1) {
      //   Vector.add(conflicts, doc);
      // };
    };
    // if (Vector.size(conflicts) > 0) return Vector.toArray(conflicts);
    // for (doc in docs.vals()) {
    //   callerDb.db.insert(doc);
    // };
    [];
  };

  public func getLatest<T>(use : DbUse<T>, updatedAt : Nat32, lastId : ?Nat64, limit : Nat) : [ItemDoc<T>] {
    let start : Nat64 = switch (lastId) {
      case (?id) {
        let ?idx = use.pk.getIdx(id) else Debug.trap("ID not found");
        (Nat64.fromNat(Nat32.toNat(updatedAt)) << 32) | Nat64.fromNat(idx);
      };
      case (null) Nat64.fromNat(Nat32.toNat(updatedAt)) << 32;
    };
    use.updatedAt.find(start, ^0, #bwd, limit);
  };

};
