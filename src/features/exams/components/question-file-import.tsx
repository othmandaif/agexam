"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { convertQuestionFileAction } from "../server/actions";

interface QuestionFileImportProps {
  onText: (text: string) => void;
  disabled?: boolean;
}

/** Import .txt (lu dans le navigateur) ou .xlsx (converti par le serveur). */
export function QuestionFileImport({ onText, disabled }: QuestionFileImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const handleFile = (file: File) => {
    setMessage(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      file.text().then((text) => onText(text.replace(/^﻿/, "")));
      return;
    }
    if (!name.endsWith(".xlsx")) {
      setMessage({ tone: "error", text: "Format non pris en charge : utilisez .txt ou .xlsx." });
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await convertQuestionFileAction(IDLE, formData);
      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message });
      } else if (result.status === "success" && result.data) {
        onText(result.data.text);
        const notes = result.data.notes;
        setMessage({
          tone: "info",
          text: `${result.data.questionCount} question(s) importée(s).${notes.length ? ` ${notes.join(" ")}` : ""}`,
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.xlsx,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Upload aria-hidden /> {pending ? "Import…" : "Importer un fichier"}
      </button>
      <a
        href="/api/v1/exams/question-template"
        download
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <FileSpreadsheet aria-hidden /> Modèle Excel
      </a>
      {message ? (
        <span
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "w-full text-sm font-semibold",
            message.tone === "error" ? "text-danger" : "text-success",
          )}
        >
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
