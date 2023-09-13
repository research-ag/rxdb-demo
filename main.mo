import AssocList "mo:base/AssocList";
import List "mo:base/List";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Vector "mo:vector";

import DB "db";

actor class TodoListDb() {

  type StableStorage<T> = AssocList.AssocList<Principal, DB.DbInit<T>>;
  type TodoListItemV1 = {
    text : Text;
    isChecked : Bool;
  };

  stable var storage : StableStorage<TodoListItemV1> = null;

  var databasesCache : AssocList.AssocList<Principal, DB.DbUse<TodoListItemV1>> = null;

  private func getDatabase(owner : Principal, notFoundStrategy : { #create; #returnNull }) : ?DB.DbUse<TodoListItemV1> {
    switch (AssocList.find(databasesCache, owner, Principal.equal)) {
      case (?db) ?db;
      case (null) {
        let init = switch (AssocList.find(storage, owner, Principal.equal)) {
          case (?store) store;
          case (null) {
            switch (notFoundStrategy) {
              case (#returnNull) return null;
              case (#create) {
                let store = DB.empty<TodoListItemV1>();
                let (upd, _) = AssocList.replace(storage, owner, Principal.equal, ?store);
                storage := upd;
                store;
              };
            };
          };
        };
        let db = DB.use(init);
        let (upd, _) = AssocList.replace(databasesCache, owner, Principal.equal, ?db);
        databasesCache := upd;
        ?db;
      };
    };
  };

  public shared ({ caller }) func push(docs : [DB.ItemDoc<TodoListItemV1>]) : async [DB.ItemDoc<TodoListItemV1>] {
    let ?db = getDatabase(caller, #create) else Debug.trap("Can never happen");
    DB.pushUpdates(db, docs);
  };

  public shared query ({ caller }) func pull(updatedAt : Nat32, lastId : ?Nat64, limit : Nat) : async [DB.ItemDoc<TodoListItemV1>] {
    switch (getDatabase(caller, #returnNull)) {
      case (?db) DB.getLatest(db, updatedAt, lastId, limit);
      case (null)[];
    };
  };

  public shared query ({ caller }) func dump() : async [(Principal, [?DB.ItemDoc<TodoListItemV1>])] {
    Iter.toArray<(Principal, [?DB.ItemDoc<TodoListItemV1>])>(
      Iter.map<(Principal, DB.DbInit<TodoListItemV1>), (Principal, [?DB.ItemDoc<TodoListItemV1>])>(
        List.toIter(storage),
        func(item) = (item.0, Vector.toArray<?DB.ItemDoc<TodoListItemV1>>(item.1.db.vec)),
      )
    );
  };

};
