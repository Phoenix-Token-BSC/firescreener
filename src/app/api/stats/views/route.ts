import { corsResponse } from "../../utils/cors";

export async function OPTIONS() {
  return corsResponse(null, 204);
}

export async function GET() {
  console.log("--- Pageviews API Route Handler ---");

  const umamiApiUrl = process.env.UMAMI_API_URL || "https://api.umami.is";
  const websiteId = "23de30be-d6d1-4152-b10c-7442a99240ce";
  const authToken = process.env.UMAMI_API_KEY;

  // console.log("UMAMI_API_URL:", umamiApiUrl);
  // console.log("UMAMI_API_KEY:", authToken ? "Set" : "Not Set");
  // console.log("Website ID:", websiteId);

  if (!authToken || !websiteId || !umamiApiUrl) {
    console.error("Umami configuration is incomplete");
    return corsResponse(
      { message: "Umami configuration is incomplete" },
      500
    );
  }

  const endAt = Date.now();
  const startAt = endAt - (30 * 24 * 60 * 60 * 1000); // Last 30 days

  // Use /stats endpoint to get total pageviews
  const requestUrl = new URL(`${umamiApiUrl.replace(/\/+$/, "")}/v1/websites/${websiteId}/stats`);
  requestUrl.searchParams.append("startAt", startAt.toString());
  requestUrl.searchParams.append("endAt", endAt.toString());

 // console.log("Request URL:", requestUrl.toString());

  try {
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "x-umami-api-key": authToken,
        "Accept": "application/json",
      },
    });

    //console.log("Umami API Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Umami Pageviews API error:", errorText);
      return corsResponse(
        {
          message: "Error fetching pageviews data",
          websiteId,
          requestUrl: requestUrl.toString(),
          status: response.status,
          body: errorText,
        },
        response.status
      );
    }

    const data = await response.json();
    //console.log("Umami API Response Data:", data);

    // Umami /stats endpoint returns an object with { pageviews: { value: number }, ... }
    const pageviews = data?.pageviews?.value ?? 0;
    const result = { pageviews };

    //console.log("Final Response to Frontend:", result);

    return corsResponse(result, 200);
  } catch (error) {
    console.error("Error fetching pageviews:", error);
    const message = error instanceof Error ? error.message : String(error);
    return corsResponse(
      {
        message: "Internal Server Error",
        error: message,
        websiteId,
        requestUrl: requestUrl.toString(),
      },
      500
    );
  }
}