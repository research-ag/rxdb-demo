export const idlFactory = ({ IDL }) => {
  const TodoListItemDoc = IDL.Record({
    'id' : IDL.Nat64,
    'deleted' : IDL.Bool,
    'isChecked' : IDL.Bool,
    'text' : IDL.Text,
    'updatedAt' : IDL.Nat32,
  });
  const TodoListDb = IDL.Service({
    'pull' : IDL.Func(
        [IDL.Nat32, IDL.Opt(IDL.Nat64), IDL.Nat],
        [IDL.Vec(TodoListItemDoc)],
        [],
      ),
    'push' : IDL.Func(
        [IDL.Vec(TodoListItemDoc)],
        [IDL.Vec(TodoListItemDoc)],
        [],
      ),
  });
  return TodoListDb;
};
export const init = ({ IDL }) => { return []; };
