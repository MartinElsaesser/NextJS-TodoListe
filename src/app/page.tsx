import App from "@/components/App";
import "./page.css";
import { backend } from "@/backend";

export default async function Home() {
  const todos = await backend.todos.getAll();
  return (
    <div id="root">
      <App $todos={todos}></App>
    </div>
  );
}
