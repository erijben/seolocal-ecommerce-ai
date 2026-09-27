<?php

namespace App\Services\Ai;

use App\Models\AiReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class AiReportPdfService
{
    public function download(AiReport $report): Response
    {
        $report->loadMissing('user');

        $pdf = Pdf::loadView('pdf.ai-report', [
            'report' => $report,
            'typeLabel' => $this->typeLabel($report->type),
            'periodLabel' => $this->extractPeriodLabel($report->content),
            'reportHtml' => Str::markdown($report->content, [
                'html_input' => 'strip',
                'allow_unsafe_links' => false,
            ]),
        ])->setPaper('a4');

        return $pdf->download(
            sprintf('rapport-ia-%d.pdf', $report->id)
        );
    }

    private function typeLabel(string $type): string
    {
        return match ($type) {
            'sales_report' => 'Rapport de ventes',
            'stock_recommendation' => 'Recommandations de stock',
            'customer_analysis' => 'Analyse des clients',
            'marketing_recommendation' => 'Recommandations marketing',
            default => 'Rapport IA',
        };
    }

    private function extractPeriodLabel(string $content): string
    {
        if (preg_match(
            '/Regroupement des ventes\s*:\s*([^_\r\n]+)/iu',
            $content,
            $matches
        ) === 1) {
            return trim($matches[1]);
        }

        return 'Non précisée';
    }
}
