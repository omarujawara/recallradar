import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Landing() {
  const [recalls, setRecalls] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('recalls')
      .select('id, recall_number, product_description, status')
      .limit(5)
      .then(({ data, error }) => (error ? setError(error.message) : setRecalls(data)));
  }, [])

  if (error) 
    return <p className="p-6 text-destructive">{error}</p>;

  return (
    <ul className="space-y-2 p-6">
      {recalls.map((r) => (
        <li key={r.id}>
          <span className="font-mono text-sm">{r.recall_number}</span>: {r.product_description.slice(0,80)}
        </li>
      ))}
    </ul>
  );


}