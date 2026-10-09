export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string | null;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

type TavilyResponse = {
  query?: string;
  answer?: string;
  results?: TavilyResult[];
  response_time?: number;
};

function getTavilyApiKey(): string | null {
  const apiKey = process.env.TAVILY_API_KEY?.trim();

  if (!apiKey) {
    console.error(
      "[WEB SEARCH] TAVILY_API_KEY is missing from .env.local"
    );

    return null;
  }

  return apiKey;
}

export async function webSearch(
  query: string
): Promise<WebSearchResult[]> {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    console.error(
      "[WEB SEARCH] Empty search query received."
    );

    return [];
  }

  const apiKey = getTavilyApiKey();

  if (!apiKey) {
    return [];
  }

  console.log("");
  console.log("====================================");
  console.log("MEDHA WEB SEARCH STARTED");
  console.log("====================================");
  console.log("Query:", cleanQuery);
  console.log("Tavily key present:", true);

  try {
    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          api_key: apiKey,

          query: cleanQuery,

          search_depth: "advanced",

          topic: "news",

          max_results: 5,

          include_answer: false,

          include_raw_content: false,

          include_images: false,
        }),

        cache: "no-store",
      }
    );

    console.log(
      "Tavily HTTP status:",
      response.status
    );

    if (!response.ok) {
      const errorBody =
        await response.text();

      console.error(
        "[WEB SEARCH] Tavily request failed."
      );

      console.error(
        "Status:",
        response.status
      );

      console.error(
        "Response:",
        errorBody
      );

      return [];
    }

    const data =
      (await response.json()) as TavilyResponse;

    if (
      !Array.isArray(data.results)
    ) {
      console.error(
        "[WEB SEARCH] Tavily returned no results array."
      );

      console.log(
        "Response keys:",
        Object.keys(data)
      );

      return [];
    }

    const results: WebSearchResult[] =
      data.results
        .filter((result) => {
          return (
            typeof result.title ===
            "string" &&
            typeof result.url ===
            "string" &&
            typeof result.content ===
            "string"
          );
        })
        .map((result) => ({
          title:
            result.title?.trim() ||
            "Untitled",

          url:
            result.url?.trim() ||
            "",

          content:
            result.content?.trim() ||
            "",

          score:
            result.score,

          publishedDate:
            result.published_date ||
            null,
        }))
        .filter(
          (result) =>
            result.url &&
            result.content
        )
        .slice(0, 5);

    console.log(
      "Tavily results found:",
      results.length
    );

    results.forEach(
      (result, index) => {
        console.log(
          `Result ${index + 1}:`,
          result.title
        );

        console.log(
          `URL ${index + 1}:`,
          result.url
        );
      }
    );

    console.log(
      "MEDHA WEB SEARCH COMPLETED"
    );

    console.log(
      "===================================="
    );

    console.log("");

    return results;
  } catch (error) {
    console.error("");
    console.error(
      "===================================="
    );

    console.error(
      "MEDHA WEB SEARCH ERROR"
    );

    console.error(
      "===================================="
    );

    if (
      error instanceof Error
    ) {
      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Stack:",
        error.stack
      );
    } else {
      console.error(error);
    }

    console.error(
      "===================================="
    );

    console.error("");

    return [];
  }
}