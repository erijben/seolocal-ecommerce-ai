<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{{ $report->title }}</title>
    <style>
        @page { margin: 28mm 20mm 22mm; }
        body {
            color: #1e293b;
            font-family: DejaVu Sans, sans-serif;
            font-size: 10.5pt;
            line-height: 1.55;
        }
        header {
            border-bottom: 2px solid #4f46e5;
            margin-bottom: 20px;
            padding-bottom: 14px;
        }
        .brand {
            color: #4f46e5;
            font-size: 10pt;
            font-weight: bold;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        h1 { color: #0f172a; font-size: 22pt; margin: 6px 0 4px; }
        h2 { color: #312e81; font-size: 15pt; margin: 22px 0 8px; }
        h3 { color: #3730a3; font-size: 12pt; margin: 16px 0 6px; }
        .metadata {
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            border-radius: 6px;
            margin-bottom: 22px;
            padding: 12px 14px;
        }
        .metadata p { margin: 3px 0; }
        .label { color: #475569; font-weight: bold; }
        ul, ol { padding-left: 20px; }
        li { margin-bottom: 4px; }
        p { margin: 7px 0; }
        footer {
            border-top: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 8.5pt;
            margin-top: 28px;
            padding-top: 10px;
            text-align: center;
        }
    </style>
</head>
<body>
    <header>
        <div class="brand">SmartCommerce AI</div>
        <h1>{{ $report->title }}</h1>
    </header>

    <section class="metadata">
        <p><span class="label">Type :</span> {{ $typeLabel }}</p>
        <p><span class="label">Période :</span> {{ $periodLabel }}</p>
        <p><span class="label">Date de génération :</span> {{ $report->generated_at->format('d/m/Y à H:i') }}</p>
    </section>

    <main>{!! $reportHtml !!}</main>

    <footer>
        Rapport généré par SmartCommerce AI — les indicateurs proviennent des données métier validées par Laravel.
    </footer>
</body>
</html>
