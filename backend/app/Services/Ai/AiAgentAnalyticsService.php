<?php

namespace App\Services\Ai;

use App\Models\AiQuestion;
use Illuminate\Support\Facades\DB;

class AiAgentAnalyticsService
{
    public function getInsights(): array
    {
        return [
            'overview' => $this->getOverview(),
            'intent_distribution' => $this->getIntentDistribution(),
            'provider_distribution' => $this->getProviderDistribution(),
            'recent_questions' => $this->getRecentQuestions(),
        ];
    }

    private function getOverview(): array
    {
        $totalQuestions = AiQuestion::count();

        $openaiCount = AiQuestion::where('provider', 'openai')->count();
        $demoCount = AiQuestion::where('provider', 'demo')->count();
        $fallbackCount = AiQuestion::where('provider', 'demo_fallback')->count();

        $mostUsedIntent = AiQuestion::select('intent', DB::raw('COUNT(*) as total'))
            ->whereNotNull('intent')
            ->groupBy('intent')
            ->orderByDesc('total')
            ->first();

        $lastQuestion = AiQuestion::latest()->first();

        return [
            'total_questions' => $totalQuestions,
            'openai_count' => $openaiCount,
            'demo_count' => $demoCount,
            'fallback_count' => $fallbackCount,
            'most_used_intent' => $mostUsedIntent?->intent,
            'most_used_intent_count' => $mostUsedIntent?->total ?? 0,
            'last_question_at' => $lastQuestion?->created_at,
        ];
    }

    private function getIntentDistribution(): array
    {
        return AiQuestion::select('intent', DB::raw('COUNT(*) as total'))
            ->whereNotNull('intent')
            ->groupBy('intent')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($item) => [
                'intent' => $item->intent,
                'total' => (int) $item->total,
            ])
            ->toArray();
    }

    private function getProviderDistribution(): array
    {
        return AiQuestion::select('provider', DB::raw('COUNT(*) as total'))
            ->whereNotNull('provider')
            ->groupBy('provider')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($item) => [
                'provider' => $item->provider,
                'total' => (int) $item->total,
            ])
            ->toArray();
    }

    private function getRecentQuestions(): array
    {
        return AiQuestion::latest()
            ->take(5)
            ->get([
                'id',
                'question',
                'intent',
                'provider',
                'created_at',
            ])
            ->toArray();
    }
}