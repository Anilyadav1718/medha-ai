"use client";

import { BrainCircuit, Hammer, Newspaper, Rocket } from "lucide-react";

const actions = [
  {
    label: "Latest AI News",
    icon: Newspaper,
    prompt:
      "Search the web for the latest important artificial intelligence news. Summarize the most significant developments and include reliable sources."
  },
  {
    label: "Explore Latest Tech",
    icon: Rocket,
    prompt:
      "Search the web for the latest important technology developments. Summarize the most significant developments and include reliable sources."
  },
  {
    label: "Learn Agentic AI",
    icon: BrainCircuit,
    prompt:
      "Teach me Agentic AI from the fundamentals using a practical industry example. Explain agents, LLMs, tools, memory, planning, RAG and tool calling."
  },
  {
    label: "Build an AI Project",
    icon: Hammer,
    prompt:
      "Help me design an industry-relevant Agentic AI project. Explain the business problem, architecture, technology stack, agent workflow and implementation plan."
  }
];

export default function QuickActions({
  onSelect
}: {
  onSelect: (display: string, prompt: string) => void;
}) {
  return (
    <div className="quick-grid">
      {actions.map(({ label, icon: Icon, prompt }) => (
        <button
          className="quick-card"
          key={label}
          onClick={() => onSelect(label, prompt)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
