<?php

namespace Tests\Feature;

use App\Models\AiReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiReportPdfExportTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    private function createReport(User $owner): AiReport
    {
        return AiReport::create([
            'user_id' => $owner->id,
            'title' => 'Rapport de ventes',
            'type' => 'sales_report',
            'content' => implode("\n", [
                '# Rapport de ventes',
                '_Regroupement des ventes : Mensuel_',
                '## 1. Résumé exécutif',
                'Activité commerciale stable.',
                '## 2. Chiffres clés',
                '- **Chiffre d’affaires :** 1 250,00 €',
                '## 7. Recommandations concrètes',
                '- Suivre les statuts de commande.',
            ]),
            'generated_at' => now(),
        ]);
    }

    public function test_manager_can_export_own_report_as_pdf(): void
    {
        $manager = $this->createUser('manager');
        $report = $this->createReport($manager);

        $response = $this->actingAs($manager)
            ->get("/api/ai/reports/{$report->id}/pdf");

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertHeader(
                'content-disposition',
                'attachment; filename=rapport-ia-'.$report->id.'.pdf'
            );

        $this->assertStringStartsWith('%PDF-', $response->streamedContent());
    }

    public function test_manager_cannot_export_another_users_report(): void
    {
        $manager = $this->createUser('manager');
        $otherManager = $this->createUser('manager');
        $report = $this->createReport($otherManager);

        $this->actingAs($manager)
            ->get("/api/ai/reports/{$report->id}/pdf")
            ->assertNotFound();
    }

    public function test_admin_can_export_another_users_report(): void
    {
        $admin = $this->createUser('admin');
        $manager = $this->createUser('manager');
        $report = $this->createReport($manager);

        $response = $this->actingAs($admin)
            ->get("/api/ai/reports/{$report->id}/pdf");

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->streamedContent());
    }

    public function test_guest_cannot_export_a_report(): void
    {
        $owner = $this->createUser('manager');
        $report = $this->createReport($owner);

        $this->getJson("/api/ai/reports/{$report->id}/pdf")
            ->assertUnauthorized();
    }

    public function test_unknown_report_returns_not_found(): void
    {
        $admin = $this->createUser('admin');

        $this->actingAs($admin)
            ->get('/api/ai/reports/999999/pdf')
            ->assertNotFound();
    }
}
