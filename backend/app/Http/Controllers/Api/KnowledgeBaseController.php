<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeDocument;
use App\Services\Ai\KnowledgeBaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;
use Illuminate\Support\Str;

class KnowledgeBaseController extends Controller
{
    public function __construct(
    private KnowledgeBaseService $knowledgeBaseService,
    private KnowledgeDocumentSyncService $knowledgeDocumentSyncService
) {
}

    public function index()
    {
        $documents = KnowledgeDocument::query()
            ->withCount('chunks')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $documents,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:50'],
            'content' => ['required', 'string', 'min:20'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $document = $this->knowledgeBaseService->createDocument(
            data: $validated,
            userId: $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Document ajouté à la base de connaissances.',
            'data' => $document,
        ], 201);
    }

    public function show(KnowledgeDocument $knowledgeDocument)
    {
        return response()->json([
            'success' => true,
            'data' => $knowledgeDocument->load('chunks'),
        ]);
    }

    public function update(Request $request, KnowledgeDocument $knowledgeDocument)
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'content' => ['sometimes', 'required', 'string', 'min:20'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $document = $this->knowledgeBaseService->updateDocument(
            document: $knowledgeDocument,
            data: $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Document mis à jour avec succès.',
            'data' => $document,
        ]);
    }


    public function uploadPdf(Request $request)
{
    $validated = $request->validate([
        'title' => ['nullable', 'string', 'max:255'],
        'type' => ['nullable', 'string', 'max:50'],
        'status' => ['nullable', 'in:active,inactive'],
        'file' => [
            'required',
            'file',
            'mimes:pdf',
            'max:10240',
        ],
    ]);

    $requestId = (
        $request->header('X-Request-ID')
        ?: (string) Str::uuid()
    );

    $document = $this->knowledgeBaseService
        ->createDocumentFromPdf(
            file: $request->file('file'),
            data: $validated,
            userId: $request->user()?->id
        );

    $syncResult = $this->knowledgeDocumentSyncService
        ->indexDocument(
            document: $document,
            requestId: $requestId,
        );

    if (data_get($syncResult, 'status') === 'error') {
        return response()->json([
            'success' => false,
            'message' => (
                'Le PDF a été enregistré, mais son '
                .'indexation sémantique est temporairement '
                .'indisponible.'
            ),
            'error_code' => data_get(
                $syncResult,
                'error_code'
            ),
            'request_id' => $requestId,
            'data' => data_get(
                $syncResult,
                'document',
                $document->fresh()
            ),
        ], 503);
    }

    $synchronizedDocument = data_get(
        $syncResult,
        'document',
        $document->fresh()
    );

    return response()->json([
        'success' => true,
        'message' => (
            data_get($syncResult, 'status') === 'ok'
                ? 'PDF ajouté et indexé avec succès.'
                : 'PDF ajouté à la base de connaissances '
                    .'avec succès.'
        ),
        'request_id' => $requestId,
        'data' => $synchronizedDocument,
    ], 201);
}


public function destroy(
    Request $request,
    KnowledgeDocument $knowledgeDocument
) {
    $requestId = (
        $request->header('X-Request-ID')
        ?: (string) Str::uuid()
    );

    $syncResult = $this->knowledgeDocumentSyncService
        ->deleteRemoteDocument(
            document: $knowledgeDocument,
            requestId: $requestId,
        );

    if (data_get($syncResult, 'status') === 'error') {
        return response()->json([
            'success' => false,
            'message' => (
                'Le document ne peut pas être supprimé '
                .'pour le moment. Réessayez ultérieurement.'
            ),
            'error_code' => data_get(
                $syncResult,
                'error_code'
            ),
            'request_id' => $requestId,
        ], 503);
    }

    if ($knowledgeDocument->file_path) {
        Storage::disk('local')->delete(
            $knowledgeDocument->file_path
        );
    }

    $knowledgeDocument->delete();

    return response()->json([
        'success' => true,
        'message' => 'Document supprimé avec succès.',
        'request_id' => $requestId,
    ]);
}

   public function search(Request $request)
{
    $validated = $request->validate([
        'query' => [
            'required',
            'string',
            'min:3',
            'max:2000',
        ],
        'limit' => [
            'nullable',
            'integer',
            'min:1',
            'max:10',
        ],
    ]);

    $limit = $validated['limit'] ?? 5;

    $requestId = (
        $request->header('X-Request-ID')
        ?: (string) Str::uuid()
    );

    $semanticResult = $this
        ->knowledgeDocumentSyncService
        ->searchDocuments(
            query: $validated['query'],
            limit: $limit,
            requestId: $requestId,
        );

    if (data_get($semanticResult, 'status') === 'error') {
        return response()->json([
            'success' => false,
            'message' => (
                'La recherche documentaire est '
                .'temporairement indisponible.'
            ),
            'error_code' => data_get(
                $semanticResult,
                'error_code'
            ),
            'request_id' => $requestId,
            'data' => [],
        ], 503);
    }

    if (data_get($semanticResult, 'status') === 'skipped') {
        $results = $this->knowledgeBaseService->search(
            query: $validated['query'],
            limit: $limit
        );
    } else {
        $results = data_get(
            $semanticResult,
            'results',
            []
        );
    }

    return response()->json([
        'success' => true,
        'request_id' => $requestId,
        'data' => $results,
    ]);
}
}