import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "../../../internal-auth";

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
};

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const OSM_HEADERS = {
  "User-Agent": "MapMint-by-Nivaro/1.0 (https://mapmint-by-nivaro.vercel.app)",
  Referer: "https://mapmint-by-nivaro.vercel.app/",
};

type OsmElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const keywordAliases: Record<string, string[]> = {
  plumber: ["plumber", "plumbing"],
  plumbers: ["plumber", "plumbing"],
  solar: ["solar", "solar_panel_installer", "photovoltaic", "renewable_energy"],
  dentist: ["dentist", "dental"],
  dentists: ["dentist", "dental"],
  cafe: ["cafe", "coffee"],
  cafes: ["cafe", "coffee"],
  restaurant: ["restaurant"],
  restaurants: ["restaurant"],
  electrician: ["electrician", "electrical"],
  electricians: ["electrician", "electrical"],
  lawyer: ["lawyer", "legal"],
  lawyers: ["lawyer", "legal"],
  gym: ["fitness_centre", "gym"],
  gyms: ["fitness_centre", "gym"],
};

function overpassPattern(keyword: string) {
  const normalized = keyword.toLowerCase().trim();
  const terms = keywordAliases[normalized] || [
    normalized,
    normalized.endsWith("s") ? normalized.slice(0, -1) : normalized,
  ];
  return Array.from(new Set(terms))
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean)
    .join("|");
}

async function searchOpenStreetMap(keyword: string, location: string, limit: number) {
  const geocodeUrl = new URL(NOMINATIM_URL);
  geocodeUrl.searchParams.set("q", location);
  geocodeUrl.searchParams.set("format", "jsonv2");
  geocodeUrl.searchParams.set("limit", "1");

  const geocodeResponse = await fetch(geocodeUrl, {
    headers: OSM_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!geocodeResponse.ok) throw new Error("The selected location could not be resolved.");
  const geocoded = await geocodeResponse.json();
  const box = geocoded?.[0]?.boundingbox;
  if (!Array.isArray(box) || box.length !== 4) {
    throw new Error("The selected location was not found in OpenStreetMap.");
  }

  const [south, north, west, east] = box.map(String);
  const bbox = `${south},${west},${north},${east}`;
  const pattern = overpassPattern(keyword);
  const query = `[out:json][timeout:25];
(
  nwr["name"~"${pattern}",i](${bbox});
  nwr["brand"~"${pattern}",i](${bbox});
  nwr["operator"~"${pattern}",i](${bbox});
  nwr["amenity"~"${pattern}",i](${bbox});
  nwr["shop"~"${pattern}",i](${bbox});
  nwr["craft"~"${pattern}",i](${bbox});
  nwr["office"~"${pattern}",i](${bbox});
  nwr["healthcare"~"${pattern}",i](${bbox});
  nwr["tourism"~"${pattern}",i](${bbox});
  nwr["leisure"~"${pattern}",i](${bbox});
);
out center tags ${limit};`;

  let overpassData: { elements?: OsmElement[] } | null = null;
  for (const endpoint of OVERPASS_URLS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...OSM_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(22000),
      });
      if (!response.ok) continue;
      overpassData = await response.json();
      break;
    } catch {
      // Try the next community-operated global instance.
    }
  }
  if (!overpassData) {
    throw new Error("The free OpenStreetMap service is busy. Please retry shortly.");
  }

  const elements = overpassData.elements || [];
  const places = elements
    .filter((element) => element.tags?.name || element.tags?.brand || element.tags?.operator)
    .slice(0, limit)
    .map((element) => {
      const tags = element.tags || {};
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
      const address = [
        street,
        tags["addr:suburb"],
        tags["addr:city"],
        tags["addr:state"],
        tags["addr:postcode"],
        tags["addr:country"],
      ].filter(Boolean).join(", ");
      const category =
        tags.craft || tags.shop || tags.amenity || tags.office ||
        tags.healthcare || tags.tourism || tags.leisure || "Business";

      return {
        id: `osm-${element.type}-${element.id}`,
        name: tags.name || tags.brand || tags.operator,
        category: category.replaceAll("_", " "),
        address: address || location,
        phone: tags["contact:phone"] || tags.phone,
        website: tags["contact:website"] || tags.website,
        status: "LISTED",
        mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        sourceName: "OpenStreetMap",
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        latitude,
        longitude,
      };
    });

  return { places, source: "openstreetmap", requestsUsed: 1 };
}

export async function POST(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in is required to use the extractor." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const keyword = String(body.keyword || "").trim();
    const location = String(body.location || "").trim();
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 60);
    const includeContact = Boolean(body.includeContact);

    if (!keyword || !location) {
      return NextResponse.json(
        { error: "Enter both a business type and a location." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        await searchOpenStreetMap(keyword, location, limit),
      );
    }

    const baseFields = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.primaryType",
      "places.primaryTypeDisplayName",
      "places.businessStatus",
      "places.googleMapsUri",
      "places.location",
    ];
    const contactFields = [
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.rating",
      "places.userRatingCount",
    ];
    const fieldMask = includeContact
      ? [...baseFields, ...contactFields].join(",")
      : baseFields.join(",");

    const pageSize = Math.min(limit, 20);
    let pageToken: string | undefined;
    const found = new Map<string, GooglePlace>();

    while (found.size < limit) {
      const googleResponse = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": `${fieldMask},nextPageToken`,
        },
        body: JSON.stringify({
          textQuery: `${keyword} in ${location}`,
          pageSize,
          ...(pageToken ? { pageToken } : {}),
        }),
      });

      const data = await googleResponse.json();
      if (!googleResponse.ok) {
        return NextResponse.json(
          { error: data?.error?.message || "Google Places rejected the request." },
          { status: googleResponse.status },
        );
      }

      for (const place of (data.places || []) as GooglePlace[]) {
        if (place.id) found.set(place.id, place);
        if (found.size >= limit) break;
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    const places = Array.from(found.values()).slice(0, limit).map((place) => ({
      id: place.id,
      name: place.displayName?.text || "Unnamed business",
      category:
        place.primaryTypeDisplayName?.text ||
        place.primaryType?.replaceAll("_", " ") ||
        "Business",
      address: place.formattedAddress || "",
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      rating: place.rating,
      reviews: place.userRatingCount,
      status: place.businessStatus,
      mapsUrl: place.googleMapsUri,
      sourceName: "Google Places",
      sourceUrl: place.googleMapsUri,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    }));

    return NextResponse.json({
      places,
      source: "google",
      requestsUsed: pageToken ? 3 : 1,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The request could not be processed.",
      },
      { status: 500 },
    );
  }
}
