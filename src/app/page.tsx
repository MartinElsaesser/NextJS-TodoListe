import App from "@/components/App";
import "./page.css";
import { getAllTodos } from "@/db/services/TodoService";

export default async function Home() {
  const todos = await getAllTodos();
  return (
    <div id="root">
      <App todos={todos}></App>
    </div>
  );
}
