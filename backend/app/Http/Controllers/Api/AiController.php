<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiQuestion;
use App\Models\AiReport;
use App\Services\AiService;
use Illuminate\Http\Request;
use App\Services\Ai\AiAgentAnalyticsService;
use App\Services\Ai\AiStockForecastService;
class AiController extends Controller
{
    public function __construct(private AiService $aiService)
    {
    }

    public function generateReport(Request $request)
    {
        $validated = $request->validate([
            'type' => [
                'required',
                'in:sales_report,stock_recommendation,customer_analysis,marketing_recommendation',
            ],
            'period' => ['nullable', 'in:daily,weekly,monthly,yearly'],
        ]);

        $period = $validated['period'] ?? 'monthly';

        $content = $this->aiService->generateReport(
            $validated['type'],
            $period
        );

        $report = AiReport::create([
            'user_id' => $request->user()->id,
            'title' => $this->getReportTitle($validated['type']),
            'type' => $validated['type'],
            'content' => $content,
            'generated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Rapport IA généré avec succès.',
            'data' => $report,
        ], 201);
    }
public function agentInsights(AiAgentAnalyticsService $analyticsService)
{
    return response()->json([
        'success' => true,
        'data' => $analyticsService->getInsights(),
    ]);
}
public function ask(Request $request)
{
    $validated = $request->validate([
        'question' => ['required', 'string', 'min:5'],
    ]);

   $result = $this->aiService->answerQuestion(
    $validated['question'],
    $request->user()->id
);

    $aiQuestion = AiQuestion::create([
         'user_id' => $request->user()->id,
    'question' => $validated['question'],
    'answer' => $result['answer'],
    'intent' => $result['intent'],
    'provider' => $result['provider'],
    'used_data' => $result['used_data'],
]);

    return response()->json([
        'success' => true,
        'message' => 'Réponse IA générée avec succès.',
        'data' => $aiQuestion,
    ], 201);
}

public function reports(Request $request)
{
    $user = $request->user();

    $query = AiReport::query()->latest();

    if ($user->role !== 'admin') {
        $query->where('user_id', $user->id);
    }

    return response()->json([
        'success' => true,
        'data' => $query->get(),
    ]);
}

public function stockForecast(AiStockForecastService $forecastService)
{
    return response()->json([
        'success' => true,
        'data' => $forecastService->getStockForecast(),
    ]);
}

  public function questions(Request $request)
{
    $user = $request->user();

    $query = AiQuestion::query()->latest();

    if ($user->role !== 'admin') {
        $query->where('user_id', $user->id);
    }

    return response()->json([
        'success' => true,
        'data' => $query->get(),
    ]);
}
    private function getReportTitle(string $type): string
    {
        return match ($type) {
            'sales_report' => 'Rapport de ventes',
            'stock_recommendation' => 'Recommandations de stock',
            'customer_analysis' => 'Analyse des clients',
            'marketing_recommendation' => 'Recommandations marketing',
            default => 'Rapport IA',
        };
    }


    private function isAdmin($user): bool
{
    return strtolower((string) ($user->role ?? '')) === 'admin';
}
}