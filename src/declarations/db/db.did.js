export const idlFactory = ({ IDL }) => {
  const TodoListItemV1 = IDL.Record({
    'isChecked' : IDL.Bool,
    'text' : IDL.Text,
  });
  const ItemDoc = IDL.Record({
    'id' : IDL.Nat64,
    'deleted' : IDL.Bool,
    'updatedAt' : IDL.Nat32,
    'payload' : TodoListItemV1,
  });
  const TodoListDb = IDL.Service({
    'dump' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Opt(ItemDoc))))],
        ['query'],
      ),
    'pull' : IDL.Func(
        [IDL.Nat32, IDL.Opt(IDL.Nat64), IDL.Nat],
        [IDL.Vec(ItemDoc)],
        ['query'],
      ),
    'push' : IDL.Func([IDL.Vec(ItemDoc)], [IDL.Vec(ItemDoc)], []),
  });
  return TodoListDb;
};
export const init = ({ IDL }) => { return []; };
