import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = JSON.parse(process.env.SKILL_ARGS || '{}');

const TODO_FILE = join(__dirname, 'todos.json');

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  createdAt: string;
}

function loadTodos(): Todo[] {
  if (!existsSync(TODO_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(TODO_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading todos:', error);
    return [];
  }
}

function saveTodos(todos: Todo[]): void {
  try {
    writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
  } catch (error) {
    console.error('Error saving todos:', error);
  }
}

function getNextId(todos: Todo[]): number {
  return todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
}

const action = args.action;

if (action === 'add') {
  const task = args.task;
  if (!task) {
    console.log('Error: task parameter is required for add action');
    process.exit(1);
  }
  
  const todos = loadTodos();
  const newTodo: Todo = {
    id: getNextId(todos),
    task,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  todos.push(newTodo);
  saveTodos(todos);
  console.log(`Task added: ${task}`);
  
} else if (action === 'list') {
  const todos = loadTodos();
  
  if (todos.length === 0) {
    console.log('No tasks found.');
    process.exit(0);
  }
  
  console.log('Todo List:');
  todos.forEach(todo => {
    const status = todo.completed ? '✓' : '○';
    console.log(`${todo.id}. [${status}] ${todo.task}`);
  });
  
} else if (action === 'complete') {
  const id = args.id;
  if (!id) {
    console.log('Error: id parameter is required for complete action');
    process.exit(1);
  }
  
  const todos = loadTodos();
  const todo = todos.find(t => t.id === id);
  
  if (!todo) {
    console.log(`Error: Task with id ${id} not found`);
    process.exit(1);
  }
  
  todo.completed = true;
  saveTodos(todos);
  console.log(`Task completed: ${todo.task}`);
  
} else if (action === 'delete') {
  const id = args.id;
  if (!id) {
    console.log('Error: id parameter is required for delete action');
    process.exit(1);
  }
  
  const todos = loadTodos();
  const todoIndex = todos.findIndex(t => t.id === id);
  
  if (todoIndex === -1) {
    console.log(`Error: Task with id ${id} not found`);
    process.exit(1);
  }
  
  const deletedTask = todos[todoIndex].task;
  todos.splice(todoIndex, 1);
  saveTodos(todos);
  console.log(`Task deleted: ${deletedTask}`);
  
} else {
  console.log('Error: Invalid action. Use add, list, complete, or delete.');
  process.exit(1);
}