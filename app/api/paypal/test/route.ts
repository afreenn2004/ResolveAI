
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.json(
      { connected: false, error: "PayPal environment variables are missing." },
      { status: 500 }
    );
  }

  try {
    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,
          error: `PayPal returned HTTP ${response.status}. Check your Sandbox credentials.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "PayPal Sandbox credentials accepted.",
    });
  } catch {
    return NextResponse.json(
      {
        connected: false,
        error: "Could not reach PayPal. Check your internet connection.",
      },
      { status: 502 }
    );
  }
}
