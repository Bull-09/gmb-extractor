import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";

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

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in is required to use the extractor." },
      { status: 401 },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        code: "API_KEY_MISSING",
        error: "A Google Places API key has not been connected yet.",
      },
      { status: 503 },
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
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    }));

    return NextResponse.json({ places, requestsUsed: pageToken ? 3 : 1 });
  } catch {
    return NextResponse.json(
      { error: "The request could not be processed." },
      { status: 500 },
    );
  }
}
