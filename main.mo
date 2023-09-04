 
import AssocList "mo:base/AssocList";
import Debug "mo:base/Debug";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";

import RXMDB "mo:rxmodb";
import PK "mo:rxmodb/primarykey";
import IDX "mo:rxmodb/index";
import Vector "mo:vector";
import Bool "mo:base/Bool";

actor class TodoListDb() {

    // ================================================== DB types ===================================================
    type TodoListItemDoc = {
      id : Nat64;
      updatedAt : Nat32;
      text : Text;
      isChecked : Bool;
      deleted : Bool;
    };
    type TodoListDbInit = {
      db : RXMDB.RXMDB<TodoListItemDoc>;
      pk : PK.Init<Nat64>;
      updatedAt : IDX.Init<Nat64>;
    };
    type TodoListDbUse = {
      db : RXMDB.Use<TodoListItemDoc>;
      pk : PK.Use<Nat64, TodoListItemDoc>;
      updatedAt : IDX.Use<Nat64, TodoListItemDoc>;
    };
    // ================================================== DB types ===================================================

  stable var storage_ : AssocList.AssocList<Principal, TodoListDbInit> = null;

  private func useTodoListDb(init : TodoListDbInit) : TodoListDbUse {
    let obs = RXMDB.init_obs<TodoListItemDoc>(); // Observables for attachments
    // PK
    let pk_config : PK.Config<Nat64, TodoListItemDoc> = {
      db = init.db;
      obs;
      store = init.pk;
      compare = Nat64.compare;
      key = func(d : TodoListItemDoc) = d.id;
      regenerate = #no;
    };
    PK.Subscribe<Nat64, TodoListItemDoc>(pk_config);

    // Index - updatedAt
    let updatedAt_config : IDX.Config<Nat64, TodoListItemDoc> = {
      db = init.db;
      obs;
      store = init.updatedAt;
      compare = Nat64.compare;
      key = func(idx : Nat, d : TodoListItemDoc) = ?((Nat64.fromNat(Nat32.toNat(d.updatedAt)) << 32) | Nat64.fromNat(idx));
      regenerate = #no;
      keep = #all;
    };
    IDX.Subscribe(updatedAt_config);

    return {
      db = RXMDB.Use<TodoListItemDoc>(init.db, obs);
      pk = PK.Use(pk_config);
      updatedAt = IDX.Use(updatedAt_config);
    };
  };

  public shared ({ caller }) func push(docs : [TodoListItemDoc]) : async [TodoListItemDoc] {
    let callerDb : TodoListDbUse = useTodoListDb(
      switch (AssocList.find(storage_, caller, Principal.equal)) {
        case (?db) db;
        case (null) {
          let db = {
            db = RXMDB.init<TodoListItemDoc>();
            pk = PK.init<Nat64>(?32);
            updatedAt = IDX.init<Nat64>(?32);
          };
          let (upd, _) = AssocList.replace(storage_, caller, Principal.equal, ?db);
          storage_ := upd;
          db;
        };
      }
    );
    // var conflicts : Vector.Vector<TodoListItemDoc> = Vector.new();
    for (doc in docs.vals()) {
      callerDb.db.insert(doc);
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

  public shared query ({ caller }) func pull(updatedAt : Nat32, lastId : ?Nat64, limit : Nat) : async [TodoListItemDoc] {
    let ?callerDbInit : ?TodoListDbInit = AssocList.find(storage_, caller, Principal.equal) else return [];
    let callerDb = useTodoListDb(callerDbInit);
    let start : Nat64 = switch (lastId) {
      case (?id) {
        let ?idx = callerDb.pk.getIdx(id) else Debug.trap("ID not found");
        (Nat64.fromNat(Nat32.toNat(updatedAt)) << 32) | Nat64.fromNat(idx);
      };
      case (null) Nat64.fromNat(Nat32.toNat(updatedAt)) << 32;
    };
    callerDb.updatedAt.find(start, ^0, #bwd, limit);
  };

};
