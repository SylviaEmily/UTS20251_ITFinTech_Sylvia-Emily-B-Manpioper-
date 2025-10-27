// pages/api-test.tsx
// Temporary debug page - DELETE after fixing
import { useState } from "react";

export default function ApiTestPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function testEndpoint(name: string, url: string) {
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      setResults(prev => ({
        ...prev,
        [name]: {
          status: response.status,
          ok: response.ok,
          data: data,
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [name]: {
          status: "ERROR",
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  }

  const tests = [
    { name: "Products (Direct)", url: "/api/admin/products" },
    { name: "Products (Proxy)", url: "/api/admin-proxy/products" },
    { name: "Orders (Direct)", url: "/api/admin/orders" },
    { name: "Orders (Proxy)", url: "/api/admin-proxy/orders" },
    { name: "Stats (Direct)", url: "/api/admin/stats" },
    { name: "Stats (Proxy)", url: "/api/admin-proxy/stats" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-2">🔧 API Debug Tool</h1>
          <p className="text-sm text-gray-600 mb-4">
            Test your API endpoints. Delete this page after fixing issues.
          </p>
          
          <div className="space-y-2 mb-6">
            {tests.map(test => (
              <button
                key={test.name}
                onClick={() => testEndpoint(test.name, test.url)}
                disabled={loading[test.name]}
                className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 disabled:opacity-50 disabled:cursor-wait"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{test.name}</div>
                    <div className="text-xs text-gray-600">{test.url}</div>
                  </div>
                  {loading[test.name] && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              tests.forEach(test => testEndpoint(test.name, test.url));
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🚀 Test All Endpoints
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          {Object.keys(results).length === 0 ? (
            <p className="text-gray-500 text-sm">Click buttons above to test endpoints</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(results).map(([name, result]) => (
                <div key={name} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      result.ok 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {result.status}
                    </span>
                    <span className="font-semibold">{name}</span>
                  </div>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-2">⚠️ Common Issues:</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li><strong>ADMIN_INVITE_KEY not set</strong> - Check .env.local file</li>
            <li><strong>MongoDB not connected</strong> - Check MONGODB_URI in .env.local</li>
            <li><strong>Server not restarted</strong> - Stop & restart npm run dev</li>
            <li><strong>404 errors</strong> - API file doesn't exist at that path</li>
            <li><strong>500 errors</strong> - Check server terminal for error details</li>
          </ul>
        </div>
      </div>
    </div>
  );
}