import AssocList "mo:base/AssocList";
import List "mo:base/List";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Vector "mo:vector";

import DB "db";

actor class TodoListDb() {

  type TodoListItem = {
    text : Text;
    isChecked : Bool;
  };

  stable var storage : AssocList.AssocList<Principal, DB.DbInit<TodoListItem>> = null;

  var databasesCache : AssocList.AssocList<Principal, DB.DbUse<TodoListItem>> = null;

  private func getDatabase(owner : Principal, notFoundStrategy : { #create; #returnNull }) : ?DB.DbUse<TodoListItem> {
    switch (AssocList.find(databasesCache, owner, Principal.equal)) {
      case (?db) ?db;
      case (null) {
        let init = switch (AssocList.find(storage, owner, Principal.equal)) {
          case (?store) store;
          case (null) {
            switch (notFoundStrategy) {
              case (#returnNull) return null;
              case (#create) {
                let store = DB.empty<TodoListItem>();
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

  public shared ({ caller }) func push(docs : [DB.ItemDoc<TodoListItem>]) : async [DB.ItemDoc<TodoListItem>] {
    let ?db = getDatabase(caller, #create) else Debug.trap("Can never happen");
    DB.pushUpdates(db, docs);
  };

  public shared query ({ caller }) func pull(updatedAt : Nat32, lastId : ?Nat64, limit : Nat) : async [DB.ItemDoc<TodoListItem>] {
    switch (getDatabase(caller, #returnNull)) {
      case (?db) DB.getLatest(db, updatedAt, lastId, limit);
      case (null)[];
    };
  };

  public shared query ({ caller }) func dump() : async [(Principal, [?DB.ItemDoc<TodoListItem>])] {
    Iter.toArray<(Principal, [?DB.ItemDoc<TodoListItem>])>(
      Iter.map<(Principal, DB.DbInit<TodoListItem>), (Principal, [?DB.ItemDoc<TodoListItem>])>(
        List.toIter(storage),
        func (item) = (item.0, Vector.toArray<?DB.ItemDoc<TodoListItem>>(item.1.db.vec))
      )
    );
  };

};
