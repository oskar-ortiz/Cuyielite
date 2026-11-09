from rag.src.chunk import Chunk
from rag.src.lexical import BM25Retriever, tokenize
from rag.src.retrieve import ExtractiveGenerator


def test_bm25_ranks_matching_page_and_ignores_accents() -> None:
    retriever = BM25Retriever(
        [
            Chunk(page=15, text="Las instalaciones brindan protección y bienestar a los animales."),
            Chunk(page=68, text="La sanidad requiere medidas preventivas para los cuyes."),
        ]
    )

    results = retriever.search(
        "¿Qué función cumplen las instalaciones que brindan bienestar a los animales cuyes?",
        top_k=2,
    )

    assert results[0].pagina == 15
    assert tokenize("protección") == tokenize("proteccion")


def test_bm25_returns_no_matches_for_out_of_corpus_terms() -> None:
    retriever = BM25Retriever([Chunk(page=15, text="Instalaciones y alojamiento de cuyes.")])

    assert retriever.search("¿Cómo configurar telescopios para observar galaxias?", top_k=5) == []
    assert ExtractiveGenerator().generate("galaxias", []) == "No encontré información en los manuales."
