# Design Proposal: Hands-Free Multimodal Voice Mode for Gemini CLI

## Summary

This proposal describes the architecture and implementation plan for enabling
real-time multimodal voice interaction in Gemini CLI.

The goal is to transform the CLI into a hands-free conversational coding
assistant, allowing developers to speak naturally and receive spoken responses.

Unlike simple speech-to-text wrappers, the system will leverage Gemini's native
multimodal audio streaming capabilities to support a continuous bidirectional
conversation loop.

The design prioritizes:

- real-time audio streaming
- minimal latency interaction
- robust voice input handling
- seamless integration with the existing CLI execution pipeline

The implementation will be delivered incrementally to ensure core voice
functionality is stable before exposing new CLI UX features.

## Problem Statement

Gemini CLI currently supports only keyboard-based interaction.

Developers frequently perform repetitive CLI tasks such as:

- installing dependencies
- running builds
- executing tests
- asking the AI coding assistant for help

Voice interaction would allow developers to perform these tasks without leaving
their coding environment or typing commands.

Additionally, voice interaction improves accessibility and enables more natural
conversational workflows with the AI agent.

The challenge is to integrate voice interaction into the CLI without introducing
fragile UX or breaking the existing command execution model.

## Design Goals

The voice mode system should satisfy the following goals:

1. Enable real-time voice input and output.
2. Support continuous conversational interaction.
3. Integrate with Gemini CLI's existing request pipeline.
4. Provide low-latency responses using streaming APIs.
5. Support multiple activation methods.
6. Provide visual feedback during interaction.
7. Allow interruption of responses during conversation.

## Non-Goals

The initial implementation will focus on establishing a reliable voice
interaction pipeline and should avoid expanding scope beyond the core
architecture.

The following capabilities are explicitly out of scope for the first
implementation:

- full background voice assistant behavior similar to consumer smart assistants
- continuous passive listening outside of explicit activation modes
- complex natural-language command suggestion systems
- advanced wake-word model training or custom wake-word engines
- full speech-to-text model development, since existing APIs or models will be
  used
- advanced graphical UI components beyond terminal-based visual feedback

The goal of this proposal is to establish a stable foundation for voice
interaction, not to build a fully featured voice assistant in the first
iteration.

## High-Level Architecture

The system introduces a multimodal streaming pipeline that connects microphone
input to the Gemini CLI execution engine.

```text
Microphone Input
       ↓
Audio Capture Layer
       ↓
Voice Activity Detection
       ↓
Audio Streaming to Gemini API
       ↓
Gemini Multimodal Processing
       ↓
Command / Response Generation
       ↓
CLI Execution
       ↓
Text + Audio Response
       ↓
Text-to-Speech Output
```

This architecture enables bidirectional streaming interaction between the
developer and the AI agent.

## Core System Components

### 1. Audio Capture Layer

The audio capture layer records microphone input and streams audio frames to the
processing pipeline.

Responsibilities:

- capture microphone input
- encode audio as PCM/WAV frames
- stream audio chunks for processing
- support cross-platform microphone access

Key considerations:

- minimal latency
- continuous audio streaming
- compatibility with Node.js environments

### 2. Voice Activity Detection (VAD)

VAD determines when the user begins and stops speaking.

Responsibilities:

- detect speech segments
- reduce background noise processing
- prevent unnecessary audio streaming

Benefits:

- lower compute usage
- improved responsiveness

### 3. Activation Modes

Voice mode should support multiple activation mechanisms.

#### Voice Activity Detection

Automatically start listening when speech is detected.

#### Push-to-Talk

User holds a hotkey to activate voice input.

Example:

```text
Ctrl + Space
```

#### Wake Word

Example activation phrase:

```text
Hey Gemini
```

Wake word detection allows hands-free interaction.

## Gemini Multimodal Audio Integration

The system will integrate with Gemini's native audio streaming APIs.

Capabilities include:

- streaming audio input
- streaming model responses
- real-time conversational context

Unlike traditional voice assistants, Gemini processes both text and audio
context together, enabling richer interactions.

Example flow:

```text
Audio Input → Gemini Streaming API → AI Response → Audio Output
```

## Intent Processing

Once audio input is processed by Gemini, the model determines the user's intent.

Possible outcomes include:

- executing CLI commands
- answering coding questions
- modifying files
- running tools

This avoids brittle keyword matching systems.

Instead, Gemini determines the correct action based on conversational context.

## CLI Execution Integration

Voice input should integrate directly with the existing CLI request pipeline.

Execution flow:

```text
voice input
   ↓
Gemini model interpretation
   ↓
tool execution
   ↓
CLI output
```

This ensures voice commands behave identically to typed commands.

## Response Generation

Responses should be optimized for spoken interaction.

Features:

- concise output
- spoken-friendly formatting
- optional text display in terminal

Example:

```text
User: build the project

Gemini: Running npm run build
```

## Text-to-Speech Output

Gemini CLI will convert model responses into spoken audio.

Responsibilities:

- synthesize speech from model output
- stream audio responses
- support configurable voices

## Interruption Support

Voice interaction must support interruptions.

Example:

```text
User: stop
```

The system should:

- halt current response generation
- allow new commands immediately

This behavior mirrors natural human conversation.

## Visual Feedback

The CLI interface should provide real-time visual feedback.

Possible indicators:

```text
Listening...
Processing...
Speaking...
```

Additionally, a waveform visualizer can show audio input levels.

## Noise Handling and Accent Robustness

The system should tolerate:

- background noise
- varying microphone quality
- multiple accents

Techniques include:

- noise filtering
- speech normalization
- adaptive transcription models

## Failure Handling

Voice interaction introduces several potential failure scenarios that must be
handled gracefully to ensure a reliable developer experience.

### Audio Input Failures

Possible causes:

- microphone not available
- microphone permission denied
- unsupported audio device

Handling strategy:

- detect microphone availability during initialization
- display clear error messages
- allow fallback to standard CLI interaction

Example message:

```text
Microphone not detected. Voice mode cannot be started.
Please check your microphone permissions or device settings.
```

### Speech Recognition Errors

Possible causes:

- background noise
- incomplete speech segments
- low transcription confidence

Handling strategy:

- ignore low-confidence transcripts
- prompt the user to repeat the command
- allow fallback to typed input

Example:

```text
Sorry, I didn't catch that. Please repeat your command.
```

### Network or API Failures

Possible causes:

- Gemini API connectivity issues
- streaming interruptions
- request timeouts

Handling strategy:

- automatically retry transient failures
- gracefully terminate the current request
- notify the user of the failure

Example:

```text
Connection to Gemini API lost. Retrying...
```

### Command Execution Failures

If a voice-triggered command fails during execution:

- display CLI error output normally
- maintain the voice session
- allow the user to continue interacting

## Security and Privacy Considerations

Voice interaction introduces new security and privacy considerations that must
be addressed carefully.

### Treat Voice Input as Untrusted Input

Voice transcripts should always be treated as untrusted user input.

Mitigations include:

- validating commands before execution
- respecting existing CLI sandboxing restrictions
- avoiding direct execution of raw transcripts

All voice-triggered actions should pass through the existing Gemini CLI tool
execution framework.

### Protection Against Prompt Injection

Voice transcripts could contain adversarial instructions intended to manipulate
the model.

Mitigation strategies:

- clearly separate system instructions from user voice input
- avoid direct concatenation of transcripts into system prompts
- rely on structured request formats when communicating with Gemini APIs

### Sensitive Audio Handling

The system should minimize unnecessary storage of voice data.

Principles:

- process audio streams in memory whenever possible
- avoid persistent storage of raw audio
- do not log sensitive voice data by default

If logging is required for debugging, it should be opt-in and clearly
documented.

### User Awareness

Users should always be aware when the system is actively listening.

Indicators should include:

- `Listening`
- `Processing`
- `Speaking`

This ensures transparency and prevents unintended recording.

## Testing Strategy

A comprehensive testing strategy is required to ensure reliability across
platforms and environments.

### Unit Tests

Unit tests will validate individual components of the voice pipeline.

Examples:

- audio buffer processing
- VAD detection logic
- command routing behavior
- streaming state transitions

Testing framework:

- existing Gemini CLI testing infrastructure
- TypeScript test suites using Vitest

### Integration Tests

Integration tests will verify that voice input successfully triggers CLI
operations.

Example test cases:

- voice command triggers tool execution
- streaming responses produce expected outputs
- interruptions cancel running responses correctly

Where possible, integration tests should use simulated audio input streams to
ensure deterministic results.

### Manual Testing

Manual testing will be required for:

- microphone device compatibility
- wake word behavior
- push-to-talk hotkeys
- real-time conversational interaction

Testing environments should include:

- macOS
- Linux
- Windows

### Performance Testing

Voice interaction requires low-latency streaming.

Performance testing should evaluate:

- audio streaming latency
- response generation latency
- system resource usage

The goal is to maintain a responsive conversational experience.

### Accessibility Testing

Voice interaction is an accessibility feature.

Testing should ensure:

- clear audible responses
- understandable spoken output
- reliable activation mechanisms

## Implementation Timeline (350 Hour Project)

### Phase 1: Voice Pipeline Foundation (Weeks 1-3)

Tasks:

- implement microphone capture
- build streaming audio pipeline
- prototype Gemini audio API integration

Deliverables:

- working audio input stream
- audio data successfully sent to Gemini

### Phase 2: Speech Interaction Loop (Weeks 4-6)

Tasks:

- integrate streaming responses
- implement conversational interaction loop
- handle transcription results

Deliverables:

- working voice conversation with Gemini

### Phase 3: Activation Modes (Weeks 7-8)

Tasks:

- implement VAD
- implement push-to-talk hotkey
- prototype wake word detection

Deliverables:

- multiple voice activation options

### Phase 4: Audio Output and TTS (Weeks 9-10)

Tasks:

- implement speech synthesis
- stream audio responses
- configurable voice settings

Deliverables:

- spoken responses from the agent

### Phase 5: UX Improvements (Weeks 11-12)

Tasks:

- waveform visualizer
- interruption support
- noise robustness improvements

Deliverables:

- polished voice interaction experience

## Example Interaction

```text
User: Hey Gemini, run the project tests

Gemini: Running npm test

User: stop

Gemini: Stopping execution
```

## Future Improvements

Possible future enhancements include:

- full conversational coding workflows
- integration with IDE extensions
- multi-language voice support
- customizable voice profiles

## Questions for Maintainers

1. Does this architecture align with the long-term direction for Gemini CLI
   voice interaction?
2. Would Gemini's native multimodal audio streaming APIs be the preferred
   approach for this integration?
3. Are there existing internal efforts or design constraints that should shape
   the implementation plan?
4. Is a phased proposal-first approach preferred before any new user-facing
   voice UX is reintroduced?

## Conclusion

This proposal introduces a modular architecture for enabling hands-free
multimodal voice interaction in Gemini CLI while prioritizing reliability,
security, and extensibility.

By first implementing the core voice pipeline and integrating it with the
existing CLI execution framework, the project can deliver a powerful
conversational coding assistant while maintaining the robustness expected from a
developer tool.
