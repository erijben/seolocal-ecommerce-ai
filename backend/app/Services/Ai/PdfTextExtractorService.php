<?php

/*prendre un fichier PDF
↓
extraire le texte
↓
retourner le texte propre*/

namespace App\Services\Ai;

use Smalot\PdfParser\Parser;

class PdfTextExtractorService
{
    public function extract(string $absolutePath): string
    {
        $parser = new Parser();

        $pdf = $parser->parseFile($absolutePath);

        $text = $pdf->getText();

        $text = preg_replace('/[ \t]+/', ' ', $text);
        $text = preg_replace('/\R{3,}/', "\n\n", $text);

        return trim($text);
    }
}