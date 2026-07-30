"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { City, Country, State } from "country-state-city";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  status?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  sourceName?: string;
  sourceUrl?: string;
  contactSource?: string;
};

const fieldOptions = [
  { key: "phone", label: "Phone", tier: "Contact" },
  { key: "email", label: "Email", tier: "Website scan" },
  { key: "website", label: "Website", tier: "Contact" },
  { key: "rating", label: "Rating", tier: "Contact" },
  { key: "hours", label: "Hours", tier: "Contact" },
];

const loaderQuotes = [
  "The best lead list is the one your team actually follows up.",
  "Good data saves more time than another meeting.",
  "Searching worldwide. Keeping the budget at zero.",
  "Small lists with real contact details beat giant messy spreadsheets.",
  "Every useful conversation begins with finding the right business.",
  "Clean data in. Better outreach out.",
  "MapMint is checking the map, removing duplicates, and minting your list.",
];

type ExtractorClientProps = {
  user: {
    displayName: string;
    email: string;
  };
  signOutPath: string;
};

export default function ExtractorClient({ user, signOutPath }: ExtractorClientProps) {
  const [keyword, setKeyword] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [countryQuery, setCountryQuery] = useState("India");
  const [stateCode, setStateCode] = useState("MH");
  const [stateQuery, setStateQuery] = useState("Maharashtra");
  const [cityName, setCityName] = useState("Mumbai");
  const [limit, setLimit] = useState(20);
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "phone",
    "email",
    "website",
    "rating",
  ]);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [message, setMessage] = useState("Ready to search");
  const [loaderQuoteIndex, setLoaderQuoteIndex] = useState(0);
  const countries = useMemo(
    () => Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const states = useMemo(
    () => State.getStatesOfCountry(countryCode).sort((a, b) => a.name.localeCompare(b.name)),
    [countryCode],
  );
  const cities = useMemo(
    () => City.getCitiesOfState(countryCode, stateCode).sort((a, b) => a.name.localeCompare(b.name)),
    [countryCode, stateCode],
  );
  const location = [cityName, stateQuery, countryQuery].filter(Boolean).join(", ");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { data }: { data: { results: unknown } | null } = await supabase
          .from("saved_searches")
          .select("results")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
          if (Array.isArray(data?.results) && data.results.length) {
            setResults(data.results as Place[]);
            setMessage("Your latest saved search was restored");
          }
      })();
      return;
    }

    const cached = localStorage.getItem("mapmint-results");
    if (cached) {
      try {
        const savedResults = JSON.parse(cached) as Place[];
        queueMicrotask(() => {
          setResults(savedResults);
          setMessage("Saved results restored");
        });
      } catch {
        localStorage.removeItem("mapmint-results");
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !enriching) return;
    const interval = window.setInterval(() => {
      setLoaderQuoteIndex((index) => {
        const next = Math.floor(Math.random() * loaderQuotes.length);
        return next === index ? (index + 1) % loaderQuotes.length : next;
      });
    }, 2800);
    return () => window.clearInterval(interval);
  }, [loading, enriching]);

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

  const startVoiceInput = () => {
    type RecognitionResult = {
      results: ArrayLike<{ 0: { transcript: string } }>;
    };
    type Recognition = {
      lang: string;
      interimResults: boolean;
      onresult: (event: RecognitionResult) => void;
      onerror: () => void;
      start: () => void;
    };
    type RecognitionConstructor = new () => Recognition;
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const RecognitionApi =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!RecognitionApi) {
      setMessage("Voice typing is not supported in this browser. You can still type the business name.");
      return;
    }
    const recognition = new RecognitionApi();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setKeyword(event.results[0]?.[0]?.transcript || "");
      setMessage("Voice input added. Review it, then start the search.");
    };
    recognition.onerror = () => setMessage("I could not hear that. Please try the microphone again.");
    recognition.start();
    setMessage("Listening…");
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
        throw new Error(data.error || "The search could not be completed.");
      }
      const currentSearchResults = Array.from(
        new Map(data.places.map((place: Place) => [place.id, place])).values(),
      ) as Place[];
      setResults(currentSearchResults);
      localStorage.setItem("mapmint-results", JSON.stringify(currentSearchResults));
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await supabase.from("saved_searches").insert({
            user_id: auth.user.id,
            keyword,
            location,
            result_count: data.places.length,
            results: currentSearchResults,
          });
        }
      }
      const sourceLabel =
        data.source === "openstreetmap" ? "OpenStreetMap" : "Google Places";
      setMessage(
        `${data.places.length} businesses found from ${sourceLabel} · ${currentSearchResults.length} unique saved`,
      );
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
      "Email",
      "Website",
      "Rating",
      "Review count",
      "Status",
      "Google Maps URL",
      "Latitude",
      "Longitude",
      "Place ID",
      "Data source",
      "Source URL",
      "Contact source",
    ];
    const rows = uniqueResults.map((place) => [
      place.name,
      place.category,
      place.address,
      place.phone || "",
      place.email || "",
      place.website || "",
      place.rating ?? "",
      place.reviews ?? "",
      place.status || "",
      place.mapsUrl || "",
      place.latitude ?? "",
      place.longitude ?? "",
      place.id,
      place.sourceName || "",
      place.sourceUrl || "",
      place.contactSource || "",
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

  const enrichContacts = async () => {
    if (!uniqueResults.length) return;
    setEnriching(true);
    setMessage("Checking public business websites for contact details…");
    try {
      const response = await fetch("/api/places/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: uniqueResults.map(({ id, website, phone, email, contactSource }) => ({
            id,
            website,
            phone,
            email,
            contactSource,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Contact enrichment failed.");
      const additions = new Map(
        (data.leads as Place[]).map((lead) => [lead.id, lead]),
      );
      const enriched = uniqueResults.map((place) => ({
        ...place,
        ...additions.get(place.id),
      }));
      setResults(enriched);
      localStorage.setItem("mapmint-results", JSON.stringify(enriched));
      const contactCount = enriched.filter(
        (place) => place.phone || place.email || place.website,
      ).length;
      setMessage(`Contact check complete · ${contactCount} of ${enriched.length} leads have contact details`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Contact enrichment failed.");
    } finally {
      setEnriching(false);
    }
  };

  const clearResults = () => {
    setResults([]);
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
          Welcome, {user.displayName}. Build clean local lead lists from open worldwide business data.
          Duplicate-safe, export-ready, and designed by Nivaro with no paid API requirement.
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
            <span className="voice-input">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="e.g. Dentists, cafés, plumbers"
                required
                data-testid="keyword"
              />
              <button type="button" onClick={startVoiceInput} aria-label="Speak business type" title="Speak business type">🎙</button>
            </span>
          </label>

          <div className="location-grid">
            <label>
              Country
              <input
                list="mapmint-countries"
                value={countryQuery}
                onChange={(event) => {
                  const query = event.target.value;
                  const match = countries.find(
                    (country) => country.name.toLowerCase() === query.toLowerCase(),
                  );
                  setCountryQuery(query);
                  setCountryCode(match?.isoCode || "");
                  setStateCode("");
                  setStateQuery("");
                  setCityName("");
                }}
                required
                data-testid="country"
                placeholder="Type a country"
              />
              <datalist id="mapmint-countries">
                {countries.map((country) => (
                  <option key={country.isoCode} value={country.name} />
                ))}
              </datalist>
            </label>
            <label>
              State / province
              <input
                list="mapmint-states"
                value={stateQuery}
                onChange={(event) => {
                  const query = event.target.value;
                  const match = states.find(
                    (state) => state.name.toLowerCase() === query.toLowerCase(),
                  );
                  setStateQuery(query);
                  setStateCode(match?.isoCode || "");
                  setCityName("");
                }}
                disabled={!states.length}
                data-testid="state"
                placeholder={states.length ? "Type a state" : "No states listed"}
              />
              <datalist id="mapmint-states">
                {states.map((state) => (
                  <option key={state.isoCode} value={state.name} />
                ))}
              </datalist>
            </label>
            <label>
              City
              <input
                list="mapmint-cities"
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                required={cities.length > 0}
                disabled={!cities.length}
                data-testid="city"
                placeholder={cities.length ? "Type a city" : "No cities listed"}
              />
              <datalist id="mapmint-cities">
                {cities.map((city) => (
                  <option key={`${city.name}-${city.latitude}-${city.longitude}`} value={city.name} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="two-col">
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
            <p>{message}</p>
          </div>
          <div className="result-actions">
            <button className="secondary" onClick={clearResults} disabled={!uniqueResults.length}>Clear</button>
            <button className="secondary" onClick={enrichContacts} disabled={!uniqueResults.length || enriching}>
              {enriching ? "Finding contacts…" : "Find contacts"}
            </button>
            <button className="export" onClick={exportCsv} disabled={!uniqueResults.length}>
              Export CSV ↓
            </button>
          </div>
        </div>

        {loading || enriching ? (
          <div className="mapmint-loader" role="status" aria-live="polite">
            <div className="loader-orbit" aria-hidden="true">
              <span className="loader-core">M</span>
              <span className="orbit-dot dot-one" />
              <span className="orbit-dot dot-two" />
              <span className="orbit-dot dot-three" />
            </div>
            <span className="loader-kicker">
              {enriching ? "CONTACT ENRICHMENT IN PROGRESS" : "WORLDWIDE SEARCH IN PROGRESS"}
            </span>
            <h3>{enriching ? "Finding the people behind the businesses." : "Minting your next lead list."}</h3>
            <p className="loader-status">
              {enriching
                ? "Checking public websites for phones and email addresses…"
                : `Searching ${location} for ${keyword || "businesses"}…`}
            </p>
            <blockquote key={loaderQuoteIndex}>
              “{loaderQuotes[loaderQuoteIndex]}”
            </blockquote>
            <div className="loader-track" aria-hidden="true"><span /></div>
            <small>Free community data can take a little longer. Please keep this page open.</small>
          </div>
        ) : uniqueResults.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th><th>Contact</th><th>Source</th><th>Rating</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {uniqueResults.map((place) => (
                  <tr key={place.id}>
                    <td><b>{place.name}</b><span>{place.category} · {place.address}</span></td>
                    <td>
                      <b>{place.phone || "No phone found"}</b>
                      <span>{place.email || "No email found"}</span>
                      <span>{place.website || "No website listed"}</span>
                    </td>
                    <td>
                      <b>{place.sourceName || "Public web"}</b>
                      <span>
                        {place.sourceUrl ? <a href={place.sourceUrl} target="_blank" rel="noreferrer">View original record ↗</a> : "Source link unavailable"}
                      </span>
                      {place.contactSource && (
                        <span><a href={place.contactSource} target="_blank" rel="noreferrer">Contact found here ↗</a></span>
                      )}
                    </td>
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
        <span>Business data © OpenStreetMap contributors · ODbL · No paid API</span>
      </footer>
    </main>
  );
}
