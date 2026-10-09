"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Linkedin,
  Mail,
  ExternalLink,
} from "lucide-react";

import type {
  Message as MessageType,
} from "@/types/chat";


/* ======================================================
   DEVELOPER CONTACT
====================================================== */

const DEVELOPER_EMAIL =
  "imanilyadav12@gmail.com";

const DEVELOPER_LINKEDIN =
  "https://www.linkedin.com/in/anil-panchitha-507694241/";

const CONTACT_MARKER =
  "__MEDHA_DEVELOPER_CONTACT__";


/* ======================================================
   CLEAN MODEL OUTPUT
====================================================== */

function cleanAssistantContent(
  content: string
): string {
  if (!content) {
    return "";
  }

  return (
    content

      /* Escaped HTML break */
      .replace(
        /\\?<br\s*\/?>/gi,
        "\n"
      )

      /* HTML spaces */
      .replace(
        /&#x20;|&#32;|&nbsp;/gi,
        " "
      )

      /* Common escaped HTML entities */
      .replace(
        /&amp;/gi,
        "&"
      )

      .replace(
        /&lt;/gi,
        "<"
      )

      .replace(
        /&gt;/gi,
        ">"
      )

      .replace(
        /&quot;/gi,
        '"'
      )

      .replace(
        /&#39;|&apos;/gi,
        "'"
      )

      /*
       * Convert bullet characters into Markdown bullets.
       *
       * Example:
       * • OpenAI announced...
       *
       * becomes:
       * - OpenAI announced...
       */
      .replace(
        /(?:^|\n)\s*•\s*/g,
        "\n- "
      )

      /*
       * Sometimes Tavily/model output produces:
       *
       * text • next point
       *
       * Convert that into a proper new line.
       */
      .replace(
        /\s+•\s+/g,
        "\n- "
      )

      /*
       * Avoid excessive blank lines.
       */
      .replace(
        /\n{3,}/g,
        "\n\n"
      )

      .trim()
  );
}


/* ======================================================
   DEVELOPER CONTACT CARD
====================================================== */

function DeveloperContactCard() {
  return (
    <div className="developer-contact-card">

      <div className="developer-contact-heading">
        <strong>
          Contact the Developer
        </strong>

        <span>
          Technical support · Bug reports · Feedback · Collaboration
        </span>
      </div>


      <p className="developer-contact-description">
        You can reach{" "}
        <strong>
          Anil Panchitha
        </strong>
        , Founder &amp; Developer of Medha AI.
      </p>


      <div className="developer-contact-actions">

        <a
          className="developer-contact-button"
          href={`mailto:${DEVELOPER_EMAIL}`}
          aria-label="Email Anil Panchitha"
        >
          <Mail size={17} />

          <span>
            Email
          </span>
        </a>


        <a
          className="developer-contact-button"
          href={DEVELOPER_LINKEDIN}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Anil Panchitha LinkedIn profile"
        >
          <Linkedin size={17} />

          <span>
            LinkedIn
          </span>

          <ExternalLink
            size={13}
            className="contact-external-icon"
          />
        </a>

      </div>

    </div>
  );
}


/* ======================================================
   MESSAGE
====================================================== */

export default function Message({
  message,
}: {
  message: MessageType;
}) {

  /* ====================================================
     USER MESSAGE
  ==================================================== */

  if (
    message.role === "user"
  ) {
    return (
      <div className="message-row user-row">

        <div className="user-bubble">
          {message.content}
        </div>

      </div>
    );
  }


  /* ====================================================
     ASSISTANT CONTENT
  ==================================================== */

  const cleanedContent =
    cleanAssistantContent(
      message.content
    );


  const showDeveloperContact =
    cleanedContent.includes(
      CONTACT_MARKER
    );


  /*
   * Never show the internal marker
   * to the end user.
   */
  const visibleContent =
    cleanedContent
      .replaceAll(
        CONTACT_MARKER,
        ""
      )
      .trim();


  /* ====================================================
     ASSISTANT MESSAGE
  ==================================================== */

  return (
    <div className="message-row assistant-row">

      <div className="assistant-avatar">

        <Image
          src="/medha-avatar.png"
          alt="Medha AI"
          width={34}
          height={34}
          onError={(event) => {
            event.currentTarget.style.display =
              "none";
          }}
        />

        <span>
          M
        </span>

      </div>


      <div className="assistant-content markdown-body">

        {visibleContent && (
          <ReactMarkdown
            remarkPlugins={[
              remarkGfm,
            ]}
          >
            {visibleContent}
          </ReactMarkdown>
        )}


        {showDeveloperContact && (
          <DeveloperContactCard />
        )}

      </div>

    </div>
  );
}