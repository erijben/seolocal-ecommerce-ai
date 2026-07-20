<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeDocument;
use App\Services\Ai\KnowledgeBaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class KnowledgeBaseController extends Controller
{
    public function __construct(private KnowledgeBaseService $knowledgeBaseService)
    {
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
        'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
    ]);

    $document = $this->knowledgeBaseService->createDocumentFromPdf(
        file: $request->file('file'),
        data: $validated,
        userId: $request->user()?->id
    );

    return response()->json([
        'success' => true,
        'message' => 'PDF ajouté à la base de connaissances avec succès.',
        'data' => $document,
    ], 201);
}



  public function destroy(KnowledgeDocument $knowledgeDocument)
{
    if ($knowledgeDocument->file_path) {
        Storage::disk('local')->delete($knowledgeDocument->file_path);
    }

    $knowledgeDocument->delete();

    return response()->json([
        'success' => true,
        'message' => 'Document supprimé avec succès.',
    ]);
}

    public function search(Request $request)
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:3'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $results = $this->knowledgeBaseService->search(
            query: $validated['query'],
            limit: $validated['limit'] ?? 5
        );

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }
}