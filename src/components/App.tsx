"use client"
import { startTransition, useCallback, useOptimistic, useState } from "react";
import "./App.css";
// import { honoClient } from "./clients/hono";
// import { useHono } from "./hooks/useHono";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "./Switch";
import { SelectTodo } from "@/db/schema/db-helper-types";
import * as backend from "@/backend";


// TODO: change type to SelectTodo[]
export function App({$todos}: {$todos:SelectTodo[]}) {
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);
	const [headline, setHeadline] = useState("");
	const [description, setDescription] = useState("");
	const [onlyUnfinishedTodos, setOnlyUnfinishedTodos] = useState(false);
	const canCreateTodo = headline.length > 0 && description.length > 0;

	const [todos, setTodos] = useState($todos);
	const [optimisticTodos, setOptimisticTodos] = useOptimistic<SelectTodo[], SelectTodo[]>(
		todos,
		(_state, newOptimisticTodos) => newOptimisticTodos
	);

	const handleDoneChanged = useCallback(
		async (todo: SelectTodo) => {
			const newOptimisticTodos = optimisticTodos.map(t =>
				t.id === todo.id ? { ...t, done: !t.done } : t
			);
			startTransition(async () => {
				setOptimisticTodos(newOptimisticTodos);
				await backend.todos.updateById({
					todoId: todo.id,
					partialTodo: {done: !todo.done},
				})
				const allTodos = await backend.todos.getAll();
				startTransition(() => {
					setTodos(allTodos);
				});
			});
		},
		[optimisticTodos, setOptimisticTodos]
	);
	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			console.log("test");

			if (over?.id && active.id !== over.id) {
				startTransition(async () => {
					const fromId = active.id as number;
					const toId = over!.id as number;

					const fromTodoIdx = optimisticTodos.findIndex(todo => todo.id === fromId);
					const toTodoIdx = optimisticTodos.findIndex(todo => todo.id === toId);
					console.log(arrayMove(optimisticTodos, fromTodoIdx, toTodoIdx));

					setOptimisticTodos(arrayMove(optimisticTodos, fromTodoIdx, toTodoIdx));
					await backend.todos.moveBetweenPositions({
						fromId,
						toId,
					})
					const allTodos = await backend.todos.getAll();
					startTransition(() => {
						setTodos(allTodos);
					});
				});
			}
		},
		[optimisticTodos, setOptimisticTodos]
	);
	const handleDelete = useCallback(
		async (todo: SelectTodo) => {
			startTransition(async () => {
				setOptimisticTodos(optimisticTodos.filter(t => t.id !== todo.id));
				await backend.todos.removeById({
					todoId: todo.id,
				})
				const allTodos = await backend.todos.getAll();
				startTransition(() => {
					setTodos(allTodos);
				});
			});
		},
		[optimisticTodos, setOptimisticTodos]
	);
	const createTodo = useCallback(async () => {
		if (!canCreateTodo) return;
		setDescription("");
		setHeadline("");

		startTransition(async () => {
			setOptimisticTodos([
				...optimisticTodos,
				{
					created_at: new Date(),
					description,
					done: false,
					headline,
					id: optimisticTodos.length + 1,
					position: optimisticTodos.length + 1,
				},
			]);

			await backend.todos.create({
				todo: {
					headline,
					description,
					done: false,
				}
			})

			const allTodos = await backend.todos.getAll();
			startTransition(() => {
				setTodos(allTodos);
			});
		});
	}, [canCreateTodo, description, headline, optimisticTodos, setOptimisticTodos]);

	return (
		<div className="app">
			<h1>Todo List</h1>
			<div className="card card__create">
				<div>Create a new todo</div>
				<div className="input-grow">
					<input
						type="text"
						placeholder="Enter the todo headline"
						value={headline}
						onChange={e => setHeadline(e.target.value)}
					/>
					<button
						className="button__add"
						onClick={() => createTodo()}
						disabled={!canCreateTodo}
					>
						Create &#x27A4;
					</button>
				</div>
				<textarea
					placeholder="Enter the todo description"
					value={description}
					onChange={e => setDescription(e.target.value)}
				></textarea>
			</div>

			<div>
				Only show not done todos &nbsp;
				<Switch
					round={true}
					size="small"
					checked={onlyUnfinishedTodos}
					onChange={() => setOnlyUnfinishedTodos(!onlyUnfinishedTodos)}
				></Switch>
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				id={"todo-list"} // SSR hydration fix
			>
				<SortableContext
					items={optimisticTodos.map(todo => todo.id)}
					strategy={verticalListSortingStrategy}
				>
					{optimisticTodos
						.filter(t => (onlyUnfinishedTodos ? t.done === false : true))
						.map(todo => (
							<SortableTodo
								key={todo.id}
								todo={todo}
								onDoneChanged={handleDoneChanged}
								onDelete={handleDelete}
							/>
						))}
				</SortableContext>
			</DndContext>
		</div>
	);
}

export default App;
function SortableTodo({
	todo,
	onDoneChanged,
	onDelete,
}: {
	todo: SelectTodo;
	onDoneChanged: (todo: SelectTodo) => void;
	onDelete: (todo: SelectTodo) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: todo.id,
		data: {
			position: todo.position,
		},
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const className = todo.done ? "card card__grab card__done" : "card card__grab";
	return (
		<div className={className} ref={setNodeRef} style={style}>
			<div className="card--left">
				<h3>{todo.headline}</h3>
				<div className="card--description">{todo.description} </div>
			</div>
			<div className="card--right">
				<Switch
					round={true}
					checked={todo.done}
					onChange={() => onDoneChanged(todo)}
					size={"medium"}
				></Switch>
				<button className="button__symbol button__danger" onClick={() => onDelete(todo)}>
					&#128465;
				</button>
				<button {...listeners} {...attributes} className="button__symbol button__handle">
					<svg viewBox="0 0 20 20" width="12">
						<path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
					</svg>
				</button>
			</div>
		</div>
	);
}
