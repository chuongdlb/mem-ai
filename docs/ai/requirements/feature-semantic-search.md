---
phase: requirements
title: Semantic Search — Requirements
description: Requirements for meaning-based memory search using vector embeddings to overcome keyword mismatch
---

# Semantic Search — Requirements

## Problem Statement

MemAI's current search implementation uses PostgreSQL `ILIKE` queries on memory titles and content. This text-based approach fails when the search query uses different terminology than what's in the memory. For example, searching for "authentication flow" won't match a memory titled "OAuth login process" even though they describe the same concept. Students accumulate memories from multiple agents using varied terminology, making keyword-based search increasingly unreliable as the memory store grows.

| Search Type | Mechanism | Limitation |
|---|---|---|
| Current: text search | `ILIKE '%query%'` on `title` and `content` | Exact substring matching only; no synonym or concept awareness |
| Planned: semantic search | Vector similarity via pgvector | Requires embedding generation and storage; dependent on Ollama availability |

**Who is affected?**
- **Students (via agents)**: MCP `memory_search` tool returns irrelevant or missing results when the query wording doesn't match stored text
- **Students (via dashboard)**: Dashboard search suffers the same keyword-matching limitations
- **Admins/Supervisors**: Cannot effectively search across student memories using conceptual queries

**Current workarounds**: Students must remember exact keywords used in their memories, or manually browse through all memories to find relevant ones.

## Goals & Objectives

### Primary Goals
1. **Generate embeddings** for memory content using the `nomic-embed-text` model via Ollama, producing 768-dimensional vectors
2. **Store embeddings** in the `memories.embedding` column using pgvector (`vector(768)` type)
3. **Hybrid search** combining text-based (`ILIKE`) and vector similarity (cosine distance) results with score blending
4. **Graceful degradation** — when Ollama is unavailable, fall back to text-only search without errors

### Secondary Goals
5. **Embedding generation on memory create/update** so vectors are always in sync with content
6. **Batch backfill** for existing memories that were created before embedding support was enabled
7. **Ollama health check** integrated into the existing `GET /api/v1/health` endpoint

### Non-Goals
- **Custom embedding models**: Only `nomic-embed-text` via Ollama is supported. No OpenAI, Cohere, or other external embedding APIs.
- **Multi-modal embeddings**: Only text content is embedded. File attachments, images, or code blocks are not treated specially.
- **Embedding-based clustering or recommendations**: The embeddings are used solely for search ranking, not for automatic categorization or "related memories" features.
- **Real-time embedding updates**: Embeddings are generated synchronously or in a background task during create/update. There is no streaming reindex pipeline.

## User Stories & Use Cases

### Student (via MCP Agent)
- As a student, I want to **search for memories using natural language** (e.g., "how we handle user login") and find relevant memories even if they use different terminology (e.g., "OAuth authentication flow").
- As a student, I want **search results ranked by relevance** so that the most conceptually similar memories appear first, not just those with exact keyword matches.

### Student (via Dashboard)
- As a student, I want the **dashboard search to use semantic matching** so I can find memories without remembering exact titles or keywords.

### Admin
- As an admin, I want to **see whether Ollama is available** in the health check so I know if semantic search is operational.
- As an admin, I want the system to **continue working when Ollama is down** — search should fall back to text-only rather than failing entirely.

### System
- As the memory service, I **generate an embedding when a memory is created or updated** and store it in the `embedding` column.
- As the search function, I **query both text (ILIKE) and vector similarity**, blend the scores, and return a unified ranked result set.
- As the health endpoint, I **check Ollama availability** with a 2-second timeout so the health check doesn't hang.

## Success Criteria

| Criterion | Target |
|---|---|
| Embedding model | `nomic-embed-text` via Ollama (`/api/embed` endpoint) |
| Embedding dimensions | 768-dimensional vectors matching the `vector(768)` column type |
| pgvector storage | Embeddings stored in `memories.embedding` column with custom Drizzle type |
| Hybrid search returns blended results | Text matches and vector similarity results merged with configurable score weights |
| Graceful degradation | `isOllamaAvailable()` returns `false` on timeout/error; search falls back to text-only |
| Health check includes Ollama | `/api/v1/health` reports Ollama status alongside DB status |
| Embedding sync on write | Embeddings generated on `createMemory` and `updateMemory` (Phase 5 planned work) |
| No external API dependencies | Ollama runs locally (or via Docker Compose); no external embedding API calls |

## Implementation Status

**Important**: This feature is partially implemented and partially planned.

### Implemented (Infrastructure)
- **Database column**: `memories.embedding` column defined as `vector(768)` in the Drizzle schema, with a custom type that handles `number[]` <-> PostgreSQL vector serialization
- **Embedding service**: `embedding.service.ts` provides `generateEmbedding(text)` and `isOllamaAvailable()` functions
- **Ollama integration**: `generateEmbedding` calls Ollama's `/api/embed` endpoint with the `nomic-embed-text` model
- **Health check helper**: `isOllamaAvailable()` pings Ollama's `/api/tags` endpoint with a 2-second timeout
- **Docker Compose**: Ollama is included in `docker-compose.dev.yml` for local development

### Not Yet Implemented (Phase 5 Planned)
- **Embedding generation on create/update**: `createMemory` and `updateMemory` in `memory.service.ts` do not call `generateEmbedding`. The `embedding` column remains `null` for all memories.
- **Vector search query**: `searchMemories` in `memory.service.ts` uses only `ILIKE` on `title` and `content`. There is no `cosine_distance` or `<=>` operator usage.
- **Hybrid score blending**: No implementation exists for combining text relevance scores with vector similarity scores.
- **Batch backfill**: No mechanism to generate embeddings for memories created before embedding support is wired in.
- **Search result ranking**: Results are ordered by `updatedAt` (most recent first), not by relevance score.

## Constraints & Assumptions

### Business Constraints
- **Self-hosted embeddings**: Ollama runs on the same VPS or a Docker container alongside the API. No external API costs or data-leaving-premises concerns. However, `nomic-embed-text` requires ~2 GB of model storage and modest GPU/CPU for inference.
- **Academic workload**: The expected scale (50 students, thousands of memories) is well within Ollama's single-instance throughput for embedding generation.

### Technical Constraints
- **Ollama dependency**: Semantic search requires Ollama to be running with the `nomic-embed-text` model pulled. If Ollama is unavailable or the model isn't loaded, embeddings cannot be generated. The `isOllamaAvailable()` check uses a 2-second timeout to avoid blocking.
- **Synchronous embedding generation**: `generateEmbedding` is an async function that blocks until Ollama responds. For large content, this could add 100-500ms to memory create/update operations. A background queue could be considered if latency becomes problematic.
- **pgvector extension required**: PostgreSQL must have the `pgvector` extension enabled (`CREATE EXTENSION vector`). This is handled in the database migration.
- **768-dimension fixed**: The `vector(768)` column type is hardcoded in the schema. Switching to a different embedding model with a different dimensionality would require a schema migration and re-embedding all existing memories.
- **No vector index**: The current schema does not define an IVFFlat or HNSW index on the embedding column. At small scale (thousands of rows), sequential scan is acceptable. At larger scale, an index would be needed for performant similarity queries.
- **Drizzle custom type**: The `vector` column uses a custom Drizzle type with manual serialization (`[1,2,3]` format). This works but means raw SQL is needed for vector operations (cosine distance, etc.) since Drizzle ORM doesn't natively support pgvector operators.

### Assumptions
- Ollama is running and the `nomic-embed-text` model is pulled before the API starts. If not, embedding features silently degrade.
- 768 dimensions from `nomic-embed-text` provide sufficient semantic resolution for the types of content stored in memories (architecture decisions, conventions, code snippets, etc.).
- The pgvector extension is available in the PostgreSQL instance (included by default in many Docker images, e.g., `pgvector/pgvector:pg16`).
- Hybrid search scoring weights (text vs. vector) will need tuning based on real usage patterns. Initial weights can be 50/50 or configurable.

## Questions & Open Items

- **Embedding on write**: When embeddings are wired into `createMemory`/`updateMemory`, should they block the response (synchronous) or be generated in the background (async with eventual consistency)? Synchronous is simpler but adds latency.
- **Backfill strategy**: For existing memories without embeddings, should a one-time migration script iterate through all rows and call `generateEmbedding`? How should failures (Ollama timeout) be handled during backfill — skip and retry, or block?
- **Vector index type**: When the memory count grows, should an HNSW index or IVFFlat index be added to the embedding column? HNSW has better recall but higher memory usage. At what row count does the index become necessary?
- **Score blending weights**: What should the default weights be for hybrid search? Should text match score and vector similarity score be equally weighted, or should one dominate? Should this be configurable per query?
- **Embedding content**: Should the embedding be generated from `content` only, or from a concatenation of `title + content + tags`? Including title and tags may improve search relevance for short content memories.
- **Ollama cold start**: The first embedding request after Ollama starts (or after the model is evicted from memory) is significantly slower. Should the API "warm up" Ollama with a dummy embedding request on startup?
- **Model upgrades**: If a better embedding model becomes available, switching requires re-embedding all memories. Should the system track which model generated each embedding to support incremental migration?
