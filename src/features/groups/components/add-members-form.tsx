"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/action-state";
import { addMembersAction } from "../server/actions";

interface AddMembersFormProps {
  groupId: string;
  students: { id: string; fullName: string; email: string }[];
}

/** Liste à cocher des étudiants disponibles, ajoutés en une fois. */
export function AddMembersForm({ groupId, students }: AddMembersFormProps) {
  const [state, action] = useActionState(addMembersAction, IDLE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Vide la sélection après un ajout réussi (ajustement pendant le rendu, sans effet).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "success") setSelected(new Set());
  }

  const allSelected = students.length > 0 && selected.size === students.length;

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="groupId" value={groupId} />
      <label className="flex items-center gap-3 border-b border-line-soft pb-2 text-sm font-bold text-muted">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)))}
        />
        Tout sélectionner ({students.length})
      </label>
      <ul className="flex max-h-80 flex-col overflow-y-auto">
        {students.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 hover:bg-canvas">
              <input
                type="checkbox"
                name="profileId"
                value={s.id}
                className="size-4 accent-primary"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{s.fullName}</span>
                <span className="block text-xs text-muted">{s.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton disabled={selected.size === 0} pendingLabel="Ajout…">
        Ajouter {selected.size > 0 ? `(${selected.size})` : ""}
      </SubmitButton>
    </form>
  );
}
