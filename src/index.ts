import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

type Role = "system" | "user" | "assistant";
type Message = { role: Role; content: string };

let messages: Message[] = [
    { role: "system", content: "You are a helpful, concise AI assistant inside a CLI." }
];

async function getCompletion(messages: Message[]) {
    const apiKey = process.env.API_KEY;
    if(!apiKey) throw new Error("Missing API_KEY in .env");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: messages,
            temperature: 0.7,
            stream: true,
        }),
    });

    if(!response.ok){
        const errorData = await response.json();
        console.error("\nAPI Error:", JSON.stringify(errorData, null, 2));
        throw new Error(`Groq API returned ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if(!reader) throw new Error("Could not get reader from response body");

    const decoder = new TextDecoder();
    let fullResponse = "";

    let buffer = "";

    while (true){
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for(const line of lines) {
            const trimmedLine = line.trim();
            if(trimmedLine === "data: [DONE]") break;
            if(line.startsWith("data: ")) {
                try {
                    const json = JSON.parse(line.substring(6));
                    const delta = json.choices[0]?.delta?.content || "";
                    if(delta) {
                        process.stdout.write(delta);
                        fullResponse += delta;
                    }
                } catch (error) {
                    
                }
            }
        }
    }

    console.log("\n");
    return fullResponse
}

rl.on("SIGINT", () => {
    console.log("\nCaught interrupt signal (Ctrl+C). Exiting...");
    rl.close();
    process.exit(0)
})



async function main(){
    try{
        while (true){
        const userInput = await rl.question("User > ");

        if(userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
            console.log("Goodbye!");
            break;
        }
        const input = userInput.trim();
        if(input.toLowerCase() === "/clear chat" || input.toLowerCase() === "/clear") {
            messages = [messages[0]!];
            console.clear();
            continue;
        }

        messages.push({ role: "user", content: userInput })
        

        process.stdout.write("AI > Thinking...");
        const maxMessages = 10;
        if (messages.length > maxMessages){
            messages.splice(1,1);
        }
        try {
            const aiResponse = await getCompletion(messages);
            process.stdout.write("\rAI > ");
            console.log(`\nAI > ${aiResponse}\n`);

            messages.push({ role: "assistant", content: aiResponse});
        }   catch (error) {
                console.log(error)
            }
        }
    } catch(error){
        console.error(error);
    } finally {
        rl.close();
    }
}

main();