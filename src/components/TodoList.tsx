import React, {useEffect, useState} from 'react';
import './TodoList.css';
import DB, {TodoListItemDocument} from "../services/database";
import {RxCollection} from "rxdb";

interface Todo {
    id: string;
    text: string;
    isChecked: boolean;
}

const TodoList: React.FC = () => {

    const [collection, setCollection] = useState<RxCollection<TodoListItemDocument>>(undefined!);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState<string>('');
    const [pulling, setPulling] = useState(false);
    const [pushing, setPushing] = useState(false);

    useEffect(() => {
        const init = async () => {
            const col = await DB.instance.getTodo();
            col.find().$.subscribe(items => setTodos(items.map(x => ({
                id: x.id,
                text: x.text,
                isChecked: x.isChecked > 0
            }))));
            setCollection(col);
            DB.instance.subscribeOnPulling().subscribe(setPulling);
            DB.instance.subscribeOnPushing().subscribe(setPushing);
        }
        init().then();
    }, []);

    const addTodo = async () => {
        if (newTodo.trim() === '') return;
        setNewTodo('');
        await collection.insert({
            id: Date.now().toString(),
            updatedAt: Math.floor(Date.now() / 1000),
            text: newTodo,
            isChecked: 0,
            deleted: false,
        });
    };


    const toggleTodoCompletion = async (id: string) => {
        const idx = todos.findIndex(x => x.id === id);
        if (idx >= 0) {
            await collection.incrementalUpsert({
                id: id,
                text: todos[idx].text,
                isChecked: (!todos[idx].isChecked) ? 1 : 0
            });
        }
    };

    const removeTodo = async (id: string) => {
        await collection.bulkRemove([id]);
    };

    return !!collection ? (
        <div className="todo-container">
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', columnGap: '1rem'}}>
                <h1>Todo List</h1>
                <div style={{flexGrow: '1'}}></div>
                {pulling && <span>Pulling...</span>}
                {pushing && <span>Pushing...</span>}
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
                            checked={todo.isChecked}
                            onChange={() => toggleTodoCompletion(todo.id)}
                        />
                        <span className={todo.isChecked ? 'completed' : ''}>{todo.text}</span>
                        <div style={{flexGrow: '1'}}></div>
                        <button onClick={() => removeTodo(todo.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </div>
    ) : <div>Loading...</div>;
};

export default TodoList;
