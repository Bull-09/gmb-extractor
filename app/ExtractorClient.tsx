"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  status?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
};

const demoPlaces: Place[] = [
  {
    id: "demo-1",
    name: "Smile Craft Dental Studio",
    category: "Dental clinic",
    address: "Linking Road, Bandra West, Mumbai, Maharashtra",
    phone: "+91 22 2640 1188",
    website: "smilecraft.example",
    rating: 4.8,
    reviews: 286,
    status: "OPERATIONAL",
  },
  {
    id: "demo-2",
    name: "Pearl Dental Care",
    category: "Dentist",
    address: "SV Road, Andheri West, Mumbai, Maharashtra",
    phone: "+91 22 4012 7766",
    website: "pearldental.example",
    rating: 4.6,
    reviews: 194,
    status: "OPERATIONAL",
  },
  {
    id: "demo-3",
    name: "The Dental Lounge",
    category: "Cosmetic dentist",
    address: "Palm Beach Road, Vashi, Navi Mumbai, Maharashtra",
    rating: 4.7,
    reviews: 121,
    status: "OPERATIONAL",
  },
];

const fieldOptions = [
  { key: "phone", label: "Phone", tier: "Contact" },
  { key: "website", label: "Website", tier: "Contact" },
  { key: "rating", label: "Rating", tier: "Contact" },
  { key: "hours", label: "Hours", tier: "Contact" },
];

type ExtractorClientProps = {
  user: {
    displayName: string;
    email: string;
  };
  signOutPath: string;
};

export default function ExtractorClient({ user, signOutPath }: ExtractorClientProps) {
  const [keyword, setKeyword] = useState("Dentists");
  const [location, setLocation] = useState("Mumbai, Maharashtra");
  const [limit, setLimit] = useState(20);
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "phone",
    "website",
    "rating",
  ]);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ready to search");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("mapmint-results");
    if (cached) {
      try {
        setResults(JSON.parse(cached));
        setMessage("Saved results restored");
      } catch {
        localStorage.removeItem("mapmint-results");
      }
    }
  }, []);

  const uniqueResults = useMemo(
    () => Array.from(new Map(results.map((place) => [place.id, place])).values()),
    [results],
  );

  const toggleField = (key: string) => {
    setSelectedFields((fields) =>
      fields.includes(key)
        ? fields.filter((field) => field !== key)
        : [...fields, key],
    );
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("Searching Google Places…");
    try {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          location,
          limit,
          includeContact: selectedFields.length > 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "API_KEY_MISSING") {
          setResults(demoPlaces.slice(0, Math.min(limit, demoPlaces.length)));
          setDemo(true);
          setMessage("Demo results shown — connect your Google key for live data");
          return;
        }
        throw new Error(data.error || "The search could not be completed.");
      }
      const merged = Array.from(
        new Map([...results, ...data.places].map((place) => [place.id, place])).values(),
      ) as Place[];
      setResults(merged);
      localStorage.setItem("mapmint-results", JSON.stringify(merged));
      setDemo(false);
      setMessage(`${data.places.length} businesses found · ${merged.length} unique saved`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      "Business name",
      "Category",
      "Address",
      "Phone",
      "Website",
      "Rating",
      "Review count",
      "Status",
      "Google Maps URL",
      "Latitude",
      "Longitude",
      "Place ID",
    ];
    const rows = uniqueResults.map((place) => [
      place.name,
      place.category,
      place.address,
      place.phone || "",
      place.website || "",
      place.rating ?? "",
      place.reviews ?? "",
      place.status || "",
      place.mapsUrl || "",
      place.latitude ?? "",
      place.longitude ?? "",
      place.id,
    ]);
    const escape = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escape(value)).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `mapmint-${keyword.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clearResults = () => {
    setResults([]);
    setDemo(false);
    localStorage.removeItem("mapmint-results");
    setMessage("Results cleared");
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="MapMint by Nivaro home">
          <span className="nivaro-icon" aria-hidden="true"><img src="/nivaro-logo.png" alt="" /></span>
          <span className="product-lockup">
            <b>MapMint</b>
            <small>BY NIVARO</small>
          </span>
          <span className="beta">INTERNAL</span>
        </a>
        <div className="top-actions">
          <span className="free-pill"><span /> FREE-ONLY MODE</span>
          <div className="account-menu">
            <span className="avatar" aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-copy">
              <b>{user.displayName}</b>
              <small>{user.email}</small>
            </span>
            <a className="sign-out" href={signOutPath}>Sign out</a>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">A NIVARO INTERNAL TOOL · GOOGLE BUSINESS DATA, MINUS THE BILL</div>
        <h1>Find the businesses.<br /><em>Keep the budget.</em></h1>
        <p>
          Welcome, {user.displayName}. Build clean local lead lists from Google Places. Duplicate-safe,
          export-ready, and designed by Nivaro to stop before paid usage.
        </p>
      </section>

      <section className="workspace">
        <form className="search-card" onSubmit={search}>
          <div className="card-heading">
            <div>
              <span className="step">01</span>
              <h2>Build your search</h2>
            </div>
            <span className="guard">₹0 guard active</span>
          </div>

          <label>
            What kind of business?
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="e.g. Dentists, cafés, plumbers"
              required
              data-testid="keyword"
            />
          </label>

          <div className="two-col">
            <label>
              Where?
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City, state or postcode"
                required
                data-testid="location"
              />
            </label>
            <label>
              Results this run
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                data-testid="limit"
              >
                <option value={10}>10 businesses</option>
                <option value={20}>20 businesses</option>
                <option value={40}>40 businesses</option>
                <option value={60}>60 businesses</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend>Contact details <span>uses the smaller free tier</span></legend>
            <div className="field-grid">
              {fieldOptions.map((field) => (
                <label className="check" key={field.key}>
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={() => toggleField(field.key)}
                  />
                  <span className="box">✓</span>
                  <span>{field.label}<small>{field.tier}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="estimate">
            <div>
              <span>Estimated charge</span>
              <strong>₹0</strong>
            </div>
            <p>Protected by app limits. Google Cloud quota recommended as a second lock.</p>
          </div>

          <button className="primary" type="submit" disabled={loading} data-testid="search">
            {loading ? "Searching…" : "Start free extraction"} <span>→</span>
          </button>
        </form>

        <aside>
          <div className="meter-card">
            <div className="card-heading compact">
              <div>
                <span className="step">02</span>
                <h2>Free allowance</h2>
              </div>
              <span className="live-dot">LIVE</span>
            </div>
            <div className="meter-copy">
              <strong>0</strong><span> / monthly safety limit</span>
            </div>
            <div className="meter"><span /></div>
            <div className="meter-labels"><span>Used this month</span><b>0%</b></div>
            <div className="safety-row">
              <span className="shield">✓</span>
              <div><b>Hard stop enabled</b><small>Paid requests are not permitted by this app.</small></div>
            </div>
          </div>

          <div className="tip-card">
            <span>SMART SAVING</span>
            <h3>Search broad. Enrich narrow.</h3>
            <p>Find IDs first, remove duplicates, then request contact details only once per business.</p>
          </div>
        </aside>
      </section>

      <section className="results-section">
        <div className="results-heading">
          <div>
            <span className="step">03</span>
            <h2>Your lead list</h2>
            <p>{message}{demo ? " · sample data only" : ""}</p>
          </div>
          <div className="result-actions">
            <button className="secondary" onClick={clearResults} disabled={!uniqueResults.length}>Clear</button>
            <button className="export" onClick={exportCsv} disabled={!uniqueResults.length}>
              Export CSV ↓
            </button>
          </div>
        </div>

        {uniqueResults.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th><th>Contact</th><th>Rating</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {uniqueResults.map((place) => (
                  <tr key={place.id}>
                    <td><b>{place.name}</b><span>{place.category} · {place.address}</span></td>
                    <td><b>{place.phone || "Not requested"}</b><span>{place.website || "No website listed"}</span></td>
                    <td><b className="rating">★ {place.rating ?? "—"}</b><span>{place.reviews ? `${place.reviews} reviews` : "No count"}</span></td>
                    <td><span className="status">{place.status === "OPERATIONAL" ? "Open" : place.status || "Unknown"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <span>↗</span>
            <h3>Your first list starts here.</h3>
            <p>Run a search above. Results will be saved on this device and ready to export.</p>
          </div>
        )}
      </section>

      <footer>
        <span className="footer-brand"><span className="nivaro-icon" aria-hidden="true"><img src="/nivaro-logo.png" alt="" /></span> MapMint by Nivaro</span>
        <span>Internal agency tool · No subscriptions. No surprise bills.</span>
      </footer>
    </main>
  );
}
