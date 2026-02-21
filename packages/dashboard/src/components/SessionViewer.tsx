interface SessionEvent {
  id: string;
  eventType: string;
  content: string;
  createdAt: string;
}

const eventColors: Record<string, string> = {
  message: "bg-blue-100 text-blue-700",
  tool_call: "bg-purple-100 text-purple-700",
  file_edit: "bg-green-100 text-green-700",
  decision: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

export default function SessionViewer({ events }: { events: SessionEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3 items-start">
          <span
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              eventColors[event.eventType] || "bg-gray-100 text-gray-500"
            }`}
          >
            {event.eventType}
          </span>
          <div className="flex-1">
            <p className="text-sm text-gray-700">{event.content}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(event.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
