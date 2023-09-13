An example of utilizing rxdb to save data locally in browser and sync it via canister.

Deployed example: https://zs7e3-7qaaa-aaaaj-qahbq-cai.icp0.io/

### RxDb data migration guide:
[This](https://github.com/research-ag/rxdb-demo/commit/d9313c76d6d447d0240e34c866ab2b7355778f48) commit is an example how to properly make some changes to Rxdb schema. Steps are:
1) **main.mo**: rename payload type definition `TodoListItem` to `TodoListItemVX`, where X is a number of current schema version
1) **main.mo**: create new type `TodoListItem` with updated schema
1) **main.mo**: create new `stable var storageVY : StableStorage<TodoListItem>`, where Y is a number of new schema version (Y = X + 1)
1) **main.mo**: implement migration logic and assign to new stable variable as it is done in the example
1) **main.mo**: replace `storageVX` with `storageVY` everywhere below
1) **frontend**: update schema, increment DB schema version, write migration function
1) **frontend**: add needed changes, related to the new structure, according to your project's requirements
