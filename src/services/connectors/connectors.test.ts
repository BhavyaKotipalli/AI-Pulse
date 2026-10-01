import { describe, expect, it } from "vitest";
import { logMomentum } from "./apis";
import { assertAllowed } from "./http";
import { parseFeed } from "./rss";
import type { SourceDefinition } from "./types";

const source: SourceDefinition = {
  slug: "test",
  name: "Test",
  kind: "rss",
  connector: "rss",
  url: "https://openai.com/news/rss.xml",
  homepage: "https://openai.com",
  credibility: 0.9,
};

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>T</title>
<item><title>Introducing &amp; testing</title><link>https://openai.com/index/x/</link><guid>x-1</guid>
<pubDate>Wed, 30 Sep 2026 17:00:00 GMT</pubDate><description><![CDATA[<p>Body <b>text</b></p>]]></description>
<dc:creator>Jane</dc:creator><category>Product</category><category>Research</category></item>
<item><title>No date</title><link>https://openai.com/index/y/</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Atom post</title><link rel="alternate" href="https://www.theverge.com/a"/><link rel="replies" href="https://x/c"/>
<id>tag:1</id><published>2026-09-30T10:00:00Z</published><summary>Sum</summary><author><name>Ann</name></author>
<category term="AI"/></entry>
</feed>`;

describe("feed parsing", () => {
  it("parses RSS 2.0, skipping entries without dates", () => {
    const items = parseFeed(RSS, source);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "x-1",
      title: "Introducing & testing",
      url: "https://openai.com/index/x/",
      author: "Jane",
      tags: ["Product", "Research"],
      kind: "article",
    });
    expect(items[0]!.summary).toContain("<p>Body");
    expect(items[0]!.publishedAt.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("parses Atom and picks the alternate link", () => {
    const [item] = parseFeed(ATOM, source);
    expect(item).toMatchObject({ title: "Atom post", url: "https://www.theverge.com/a", author: "Ann", tags: ["AI"] });
  });

  it("tolerates garbage", () => {
    expect(parseFeed("<html>not a feed</html>", source)).toEqual([]);
  });
});

describe("http guard", () => {
  it("only allows HTTPS requests to allow-listed hosts", () => {
    expect(() => assertAllowed("https://openai.com/news/rss.xml")).not.toThrow();
    expect(() => assertAllowed("http://openai.com/news/rss.xml")).toThrow(/HTTPS/);
    expect(() => assertAllowed("https://169.254.169.254/latest/meta-data")).toThrow(/allow-listed/);
  });
});

describe("momentum normalization", () => {
  it("is log-scaled and capped", () => {
    expect(logMomentum(0, 100)).toBe(0);
    expect(logMomentum(100, 100)).toBe(100);
    expect(logMomentum(10_000, 100)).toBe(100);
    expect(logMomentum(10, 1000)).toBeLessThan(50);
  });
});
