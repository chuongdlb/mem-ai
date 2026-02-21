interface TimelineItem {
  id: string;
  title: string;
  content: string;
  category: string;
  sourceAgent?: string;
  updatedAt: string;
}

export default function MemoryTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="relative pl-10">
            <div className="absolute left-3 top-2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
                <span className="text-xs text-gray-400">
                  {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
              <div className="flex gap-1 mt-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.category}</span>
                {item.sourceAgent && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{item.sourceAgent}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
