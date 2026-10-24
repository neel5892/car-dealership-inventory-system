
import { useEffect, useState } from 'react';
import './App.css';

const API = 'http://localhost:3000';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

interface Vehicle {
  id: number;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

interface VehicleForm {
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: string;
}

const emptyVehicle: VehicleForm = {
  make: '',
  model: '',
  category: '',
  price: '',
  quantity: '',
};

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('token') || ''
  );
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? (JSON.parse(saved) as User) : null;
  });

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<VehicleForm>(emptyVehicle);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [restockId, setRestockId] = useState<number | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Connecting to server...');

    try {
      const endpoint =
        mode === 'login' ? '/api/auth/login' : '/api/auth/register';

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email, password }
            : { name, email, password }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Something went wrong.');
        return;
      }

      if (mode === 'register') {
        setMode('login');
        setPassword('');
        setMessage('Account created! Sign in with your new account.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setMessage('');
    } catch {
      setMessage('Cannot connect to the backend. Check that it is running.');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setVehicles([]);
    setPassword('');
    setMessage('');
  }

  async function loadVehicles(searchTerm = '') {
    if (!token) return;

    setLoading(true);
    setMessage('');

    try {
      const endpoint = searchTerm.trim()
        ? `${API}/api/vehicles/search?make=${encodeURIComponent(searchTerm)}&model=${encodeURIComponent(searchTerm)}&category=${encodeURIComponent(searchTerm)}`
        : `${API}/api/vehicles`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Could not load vehicles.');
        if (response.status === 401) logout();
        return;
      }

      setVehicles(data);
    } catch {
      setMessage('Unable to load inventory. Check your backend connection.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadVehicles();
    // Load inventory when the authenticated session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function updateForm(field: keyof VehicleForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: String(vehicle.price),
      quantity: String(vehicle.quantity),
    });
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyVehicle);
  }

  async function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || user.role !== 'admin') {
      setMessage('Admin access required.');
      return;
    }

    const price = Number(form.price);
    const quantity = Number(form.quantity);

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.category.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setMessage('Enter valid vehicle details, price, and stock quantity.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const isEditing = editingId !== null;
      const response = await fetch(
        isEditing
          ? `${API}/api/vehicles/${editingId}`
          : `${API}/api/vehicles`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            make: form.make.trim(),
            model: form.model.trim(),
            category: form.category.trim(),
            price,
            quantity,
          }),
        }
      );

      const data = response.status === 204 ? null : await response.json();

      if (!response.ok) {
        setMessage(data?.error || 'Unable to save vehicle.');
        return;
      }

      setMessage(isEditing ? 'Vehicle updated successfully.' : 'Vehicle added successfully.');
      setForm(emptyVehicle);
      setEditingId(null);
      await loadVehicles(search);
    } catch {
      setMessage('Unable to connect to the backend.');
    } finally {
      setSaving(false);
    }
  }

  async function restockVehicle(id: number) {
    if (!user || user.role !== 'admin') {
      setMessage('Admin access required.');
      return;
    }

    const quantity = Number(restockQuantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage('Restock quantity must be a positive whole number.');
      return;
    }

    try {
      const response = await fetch(`${API}/api/vehicles/${id}/restock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Restocking failed.');
        return;
      }

      setMessage(`${data.make} ${data.model} restocked successfully.`);
      setRestockId(null);
      setRestockQuantity('1');
      await loadVehicles(search);
    } catch {
      setMessage('Unable to connect to the backend.');
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!user || user.role !== 'admin') {
      setMessage('Admin access required.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/api/vehicles/${vehicle.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error || 'Unable to delete vehicle.');
        return;
      }

      setMessage(`${vehicle.make} ${vehicle.model} deleted.`);
      if (editingId === vehicle.id) cancelEdit();
      await loadVehicles(search);
    } catch {
      setMessage('Unable to connect to the backend.');
    }
  }

  async function purchaseVehicle(id: number) {
    try {
      const response = await fetch(`${API}/api/vehicles/${id}/purchase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Purchase failed.');
        return;
      }

      setMessage(`${data.make} ${data.model} purchased successfully.`);
      await loadVehicles(search);
    } catch {
      setMessage('Unable to complete purchase.');
    }
  }

  if (token && user) {
    return (
      <main className="min-h-screen bg-slate-100">
        <header className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">🚗 AutoStock</h1>
              <p className="text-sm text-slate-500">Car Dealership Inventory</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium text-slate-800">{user.name}</p>
                <p className="text-xs capitalize text-slate-500">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Vehicle Inventory</h2>
              <p className="mt-2 text-slate-500">Browse vehicles and check available stock.</p>
            </div>
            <div className="rounded-xl bg-white px-5 py-3 shadow-sm">
              <p className="text-sm text-slate-500">Vehicles listed</p>
              <p className="text-2xl font-bold text-blue-600">{vehicles.length}</p>
            </div>
          </div>

          {user.role === 'admin' && (
            <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-xl font-bold text-slate-900">
                {editingId !== null ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h3>

              <form onSubmit={saveVehicle} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <input
                  required
                  value={form.make}
                  onChange={(e) => updateForm('make', e.target.value)}
                  placeholder="Make (e.g. Toyota)"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <input
                  required
                  value={form.model}
                  onChange={(e) => updateForm('model', e.target.value)}
                  placeholder="Model (e.g. Camry)"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <input
                  required
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                  placeholder="Category (e.g. Sedan)"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateForm('price', e.target.value)}
                  placeholder="Price (₹)"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => updateForm('quantity', e.target.value)}
                  placeholder="Stock quantity"
                  className="rounded-lg border border-slate-300 px-4 py-3"
                />
                <div className="flex gap-2">
                  <button
                    disabled={saving}
                    type="submit"
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Add Vehicle'}
                  </button>
                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-300 px-4 py-3"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          <form
            className="mb-6 flex flex-wrap gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              loadVehicles(search);
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search make, model, or category..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                loadVehicles('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium hover:bg-slate-50"
            >
              Clear
            </button>
          </form>

          {message && (
            <p role="status" className="mb-5 rounded-lg bg-blue-50 p-4 text-blue-800">
              {message}
            </p>
          )}

          {loading ? (
            <p className="py-12 text-center text-slate-500">Loading inventory...</p>
          ) : vehicles.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <p className="text-xl font-semibold text-slate-700">No vehicles found</p>
              <p className="mt-2 text-slate-500">Add a vehicle or try another search.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <article key={vehicle.id} className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-blue-600">{vehicle.category}</p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        {vehicle.make} {vehicle.model}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">ID {vehicle.id}</span>
                  </div>

                  <p className="mb-4 text-2xl font-bold text-slate-900">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      maximumFractionDigits: 0,
                    }).format(vehicle.price)}
                  </p>

                  <div className="mb-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm text-slate-500">Available stock</span>
                    <span className={`font-semibold ${vehicle.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {vehicle.quantity > 0 ? vehicle.quantity : 'Out of stock'}
                    </span>
                  </div>

                  <button
                    disabled={vehicle.quantity === 0}
                    onClick={() => purchaseVehicle(vehicle.id)}
                    className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {vehicle.quantity > 0 ? 'Purchase vehicle' : 'Unavailable'}
                  </button>

                  {user.role === 'admin' && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => startEdit(vehicle)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteVehicle(vehicle)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>

                      {restockId === vehicle.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={restockQuantity}
                            onChange={(e) => setRestockQuantity(e.target.value)}
                            aria-label="Restock quantity"
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                          />
                          <button
                            onClick={() => restockVehicle(vehicle.id)}
                            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRestockId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setRestockId(vehicle.id);
                            setRestockQuantity('1');
                          }}
                          className="w-full rounded-lg bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                        >
                          Restock
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white">🚗</div>
          <h1 className="text-3xl font-bold text-slate-900">AutoStock</h1>
          <p className="mt-2 text-slate-500">Car Dealership Inventory System</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
            className={`rounded-md py-2 font-medium ${mode === 'login' ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setMessage('');
            }}
            className={`rounded-md py-2 font-medium ${mode === 'register' ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
              placeholder="At least 8 characters"
            />
          </div>

          <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">Secure access to your dealership inventory</p>
      </div>
    </div>
  );
}

export default App;
