import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server'; // For Cookie Auth
import { createClient as createClientJS } from '@supabase/supabase-js'; // For Header Auth
import { NextRequest, NextResponse } from 'next/server';
import { createSearchPlacesTool, createGetPlaceInfoTool } from '@/lib/ai/tools';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    
    // --- 1. AUTHENTICATION FIX ---
    let supabase;
    let user;

    // Check for Authorization Header (Bearer Token)
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader) {
      // CASE A: Client sent a Token (useChat hook often does this)
      // We must use the 'supabase-js' client which supports manual headers
      supabase = createClientJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: authHeader } },
        }
      );
    } else {
      // CASE B: Client sent Cookies (Browser session)
      supabase = await createClient();
    }

    // Verify User
    const { data: authData } = await supabase.auth.getUser();
    user = authData.user;

    if (!user) {
      console.error("Auth failed: No user found in Token or Cookies");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // -----------------------------

    // Verify Trip Membership
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .single();

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const { messages: requestMessages } = await request.json();

    // Extract the latest user message
    const latestUserMessage = requestMessages
      ?.filter((m: any) => m.role === 'user' && m.content && m.content.trim())
      .pop();

    if (latestUserMessage && latestUserMessage.content?.trim()) {
      // Save user message (Server-side)
      const { error: msgError } = await supabase
        .from('trip_messages')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          content: latestUserMessage.content.trim(),
          role: 'user',
        } as any);

      if (msgError) {
        console.error('Failed to save user message:', msgError);
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
      }
    }

    // Check Trigger
    const messageContent = latestUserMessage?.content?.trim() || '';
    const aiTrigger = 'hey trippee';
    const isAiRequest = messageContent.toLowerCase().startsWith(aiTrigger);

    if (!isAiRequest) {
      return new Response('', { status: 200 });
    }

    const aiMessage = messageContent.slice(aiTrigger.length).trim();

    // Prepare Context
    const { data: places } = await supabase
      .from('places')
      .select('id, name, lat, lng, category')
      .eq('trip_id', tripId);

    // Convert messages to AI SDK format, removing "Hey Trippee" prefix from latest message
    const messages = (requestMessages || []).map((msg: any, index: number) => {
      // Replace the last user message with the cleaned version (without "Hey Trippee")
      if (index === requestMessages.length - 1 && msg.role === 'user') {
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: aiMessage || 'Hello', // If message was just "Hey Trippee", use "Hello"
        };
      }
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    });

    // First generation - may include tool calls
    let result = await generateText({
      model: google('gemini-2.5-flash'), 
      system: `You are a collaborative travel planning assistant helping a group plan their trip. You're part of a group chat where all trip members can see your responses.

IMPORTANT: After using the search_places tool, you MUST provide a text response explaining the results to the user. Never finish with just tool calls - always follow up with a helpful message.

## Your Capabilities
- **Place Recommendations**: Use the search_places tool to find locations and add them to the map
- **General Trip Planning**: Provide advice on itinerary structure, timing, logistics, and travel tips
- **Group Coordination**: Help coordinate activities that work for multiple people
- **Local Insights**: Share knowledge about destinations, culture, transportation, and best practices

## Your Behavior
1. **When users ask for places**: Use the search_places tool to find and add places. The tool returns a success message with the number of places added - it does NOT return place names or details.
   
   **IMPORTANT - Quantity Detection**: Pay close attention to the number of places the user wants:
   - If they say "find me a cafe" or "find me one cafe" → use limit=1
   - If they say "find me cafes" (no number) → use limit=3 (reasonable default)
   - If they say "find me 5 cafes" or "find me 10 restaurants" → extract the number and use that as the limit
   - Always match the user's intent for quantity - if they specify a number, use it exactly
   
   **CRITICAL - Response Format**: When you use the search_places tool:
   - The tool returns a success message with placesAdded count - you do NOT see place names
   - Your response MUST be friendly and brief: "Great! I've added [X] place(s) to your itinerary. Check the itinerary panel on the right to see [it/them]! 🗺️"
   - Replace [X] with the number from the tool's placesAdded field
   - Use "it" for 1 place, "them" for multiple places
   - NEVER mention place names - you don't have access to them
   - NEVER say "I found X places" or "Here are some options"
   
2. **When users ask about specific places**: Use the get_place_info tool to provide detailed information:
   - If they ask "Tell me about [place name]", "What is [place name]?", "Give me info about [place name]"
   - If they ask about a place that's already in their itinerary (e.g., "Tell me about the first place on Day 1")
   - The tool will return detailed information including address, rating, reviews, opening hours, photos, etc.
   - Share this information in a helpful, conversational way
   
3. **When users ask for planning advice**: Provide helpful guidance on:
   - Itinerary structure and day-by-day planning
   - Best times to visit attractions
   - Transportation options and routes
   - Budget tips and cost-saving strategies
   - Local customs and cultural etiquette
   - Weather considerations
   - Packing suggestions
   - Group coordination (scheduling, meeting points, etc.)

3. **Be proactive**: If users seem stuck, offer suggestions or ask clarifying questions
4. **Be conversational**: This is a group chat - address the whole group naturally
5. **Be helpful and concise**: Provide actionable advice without being overwhelming

## Context
- Trip ID: ${tripId}
- Current places on map: ${places?.length || 0}

Remember: You're helping real people plan real trips. Be practical, friendly, and considerate of different travel styles and preferences. When you add places using the search_places tool, do NOT mention specific place names - just tell the user to check the itinerary panel.`,
      messages,
      tools: {
        search_places: createSearchPlacesTool(tripId),
        get_place_info: createGetPlaceInfoTool(tripId),
      },
    });

    // If the result finished with tool calls but no text, generate a simple response
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep && (lastStep as any).finishReason === 'tool-calls' && !result.text) {
      console.log('AI finished with tool calls but no text, generating fallback response...');
      
      // Check tool results for placesAdded (new format) or results (old format)
      let placesAdded = 0;
      if (result.steps) {
        for (const step of result.steps) {
          if ((step as any).content) {
            for (const item of (step as any).content) {
              if (item.type === 'tool-result') {
                const output = item.output?.value || item.output;
                if (output?.placesAdded) {
                  placesAdded = output.placesAdded;
                } else if (output?.results && Array.isArray(output.results)) {
                  placesAdded = output.results.length;
                }
              }
            }
          }
        }
      }
      
      // Generate a simple text response
      if (placesAdded > 0) {
        result = {
          ...result,
          text: `Great! I've added ${placesAdded} place${placesAdded > 1 ? 's' : ''} to your itinerary. Check the itinerary panel on the right to see ${placesAdded > 1 ? 'them' : 'it'}! 🗺️`,
        } as typeof result;
      } else {
        result = {
          ...result,
          text: "I couldn't find any places matching your search. Try a different location or category!",
        } as typeof result;
      }
    }

    // Extract Tools from result steps
    const toolInvocations: Array<{ toolName: string; result?: any }> = [];
    console.log('AI result steps:', JSON.stringify(result.steps, null, 2));
    console.log('AI result text:', result.text);
    
    if (result.steps) {
        for (const step of result.steps) {
            // Check for content array with tool-call and tool-result items
            if ((step as any).content && Array.isArray((step as any).content)) {
                const content = (step as any).content;
                const toolCalls = content.filter((item: any) => item.type === 'tool-call');
                const toolResults = content.filter((item: any) => item.type === 'tool-result');
                
                // Match tool calls with their results
                for (const toolCall of toolCalls) {
                    const matchingResult = toolResults.find((tr: any) => tr.toolCallId === toolCall.toolCallId);
                    if (matchingResult) {
                        // Extract result from output.value or output directly
                        let toolResult = matchingResult.output;
                        console.log('Raw tool result:', JSON.stringify(toolResult, null, 2));
                        
                        // Handle different result structures
                        if (toolResult?.value) {
                            toolResult = toolResult.value;
                        }
                        
                        // Preserve the full tool result structure (includes allResults, results, requestedLimit, etc.)
                        // The tool returns: { success, placesAdded, message, results, allResults, requestedLimit }
                        // We want to pass this through to the client as-is
                        if (Array.isArray(toolResult)) {
                            // If toolResult is directly an array, wrap it but preserve it
                            toolResult = { results: toolResult, allResults: toolResult };
                        } else if (toolResult && typeof toolResult === 'object') {
                            // Ensure results and allResults are both present
                            if (toolResult.allResults && !toolResult.results) {
                                toolResult.results = toolResult.allResults;
                            } else if (toolResult.results && !toolResult.allResults) {
                                toolResult.allResults = toolResult.results;
                            }
                        } else {
                            // Fallback: empty structure
                            toolResult = { results: [], allResults: [] };
                        }
                        
                        // Validate results array structure
                        if (toolResult?.results && Array.isArray(toolResult.results)) {
                            console.log('Tool result has', toolResult.results.length, 'places');
                            if (toolResult.results.length > 0) {
                                console.log('First place in result:', JSON.stringify(toolResult.results[0], null, 2));
                            }
                        }
                        
                        console.log('Found tool call:', toolCall.toolName, 'Final result structure:', JSON.stringify(toolResult, null, 2));
                        toolInvocations.push({
                            toolName: toolCall.toolName,
                            result: toolResult
                        });
                    }
                }
            }
        }
    }
    
    console.log('Extracted tool invocations:', JSON.stringify(toolInvocations, null, 2));

    // Save AI Response
    if (result.text && result.text.trim()) {
      const { error: aiMsgError } = await supabase
        .from('trip_messages')
        .insert({
          trip_id: tripId,
          user_id: null,
          content: result.text.trim(),
          role: 'assistant',
        } as any);
      
      if (aiMsgError) {
        console.error('Failed to save AI message:', aiMsgError);
      } else {
        console.log('AI message saved successfully');
      }
    } else {
      console.warn('AI response text is empty:', result.text);
    }

    console.log('Returning response with content length:', result.text?.length || 0, 'and tool invocations:', toolInvocations.length);

    return NextResponse.json({
      content: result.text || '',
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}