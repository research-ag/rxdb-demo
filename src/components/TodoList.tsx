import React, {useEffect, useState} from 'react';
import './TodoList.css';
import DB, {TodoListItemDocument} from "../services/database";
import {RxCollection} from "rxdb";
import {Identity} from "@dfinity/agent";

interface Todo {
    id: string;
    payload: {
        text: string;
        isChecked: boolean;
    }
}

interface Props {
    identity: Identity;
}

const TodoList: React.FC<Props> = ({identity}: Props) => {

    const [collection, setCollection] = useState<RxCollection<TodoListItemDocument>>(undefined!);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState<string>('');
    const [pulling, setPulling] = useState(false);
    const [pushing, setPushing] = useState(false);

    const [db, setDb] = useState<DB | null>(null);

    useEffect(() => {
        const init = async () => {
            if (db) {
                db.stop();
            }
            const database = new DB(identity);
            setDb(database);
            const col = await database.getTodo();
            col.find().$.subscribe(items => setTodos(items.map(x => ({
                id: x.id,
                payload: x.payload,
            }))));
            setCollection(col);
            database.subscribeOnPulling().subscribe(setPulling);
            database.subscribeOnPushing().subscribe(setPushing);
        }
        init().then();
    }, [identity]);

    const addTodo = async () => {
        if (newTodo.trim() === '') return;
        setNewTodo('');
        await collection.insert({
            id: Date.now().toString(),
            updatedAt: Math.floor(Date.now() / 1000),
            deleted: false,
            payload: {
                text: newTodo,
                isChecked: false,
            }
        });
    };

    const toggleTodoCompletion = async (id: string) => {
        const idx = todos.findIndex(x => x.id === id);
        if (idx >= 0) {
            await collection.incrementalUpsert({
                id: id,
                payload: {
                    text: todos[idx].payload.text,
                    isChecked: !todos[idx].payload.isChecked,
                },
            });
        }
    };

    const refresh = async () => {
        db!.refresh();
    };

    const removeTodo = async (id: string) => {
        await collection.bulkRemove([id]);
    };

    return !!collection ? (
        <div className="todo-container">
            <div style={{display: 'flex', width: '100%', alignItems: 'center', columnGap: '1rem'}}>
                <h1>Todo List</h1>
                <div style={{flexGrow: '1'}}></div>
                {pulling && <span>Pulling...</span>}
                {pushing && <span>Pushing...</span>}
                {db && !pulling && !pushing && <button onClick={() => refresh()}>Refresh</button>}
            </div>
            <div className="add-todo">
                <input
                    type="text"
                    placeholder="Add a new task"
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                />
                <button onClick={addTodo}>Add</button>
            </div>
            <ul className="todo-list">
                {todos.map((todo) => (
                    <li key={todo.id}>
                        <input
                            type="checkbox"
                            checked={todo.payload.isChecked}
                            onChange={() => toggleTodoCompletion(todo.id)}
                        />
                        <span className={todo.payload.isChecked ? 'completed' : ''}>{todo.payload.text}</span>
                        <div style={{flexGrow: '1'}}></div>
                        <button onClick={() => removeTodo(todo.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </div>
    ) : <div>Loading...</div>;
};

export default TodoList;
