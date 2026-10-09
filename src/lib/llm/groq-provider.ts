import "server-only";

import {
    getGroq,
    GROQ_MODEL,
} from "@/lib/groq";

import type {
    Message,
} from "@/types/chat";


/* ======================================================
   CREATE GROQ STREAM
====================================================== */

export async function createGroqProviderStream(
    messages:
        Message[],

    systemPrompt:
        string
): Promise<
    AsyncIterable<string>
> {

    const groq =
        getGroq();


    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "MEDHA GROQ STARTED"
    );

    console.log(
        "===================================="
    );

    console.log(
        "Model:",
        GROQ_MODEL
    );


    /* ====================================================
       GROQ REQUEST
    ==================================================== */

    const response =
        await groq
            .chat
            .completions
            .create({
                model:
                    GROQ_MODEL,

                messages: [

                    {
                        role:
                            "system",

                        content:
                            systemPrompt,
                    },


                    ...messages
                        .slice(-14)
                        .map(
                            (
                                message
                            ) => ({

                                role:
                                    message.role,

                                content:
                                    message.content,
                            })
                        ),
                ],

                stream:
                    true,

                temperature:
                    0.3,

                max_tokens:
                    3000,
            });


    console.log(
        "Groq stream ready."
    );


    /* ====================================================
       CONVERT GROQ CHUNKS TO TEXT
    ==================================================== */

    async function* textStream():
        AsyncGenerator<string> {

        for await (
            const chunk
            of response
        ) {

            const text =
                chunk
                    .choices?.[0]
                    ?.delta
                    ?.content ||
                "";


            if (
                text
            ) {
                yield text;
            }
        }
    }


    return textStream();
}