import re
import os
import json
import math
from typing import List, Dict, Any, Tuple

# Simple list of English stopwords to improve TF-IDF accuracy
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't",
    'should', "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn',
    "couldn't", 'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't",
    'isn', "isn't", 'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't",
    'shouldn', "shouldn't", 'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"
}

STORE_FILE = os.getenv(
    "RAG_STORE_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "rag_store.json")
)

class RAGService:
    def __init__(self):
        self.store = {}
        self.load_store()

    def load_store(self):
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r") as f:
                    self.store = json.load(f)
            except Exception as e:
                print(f"Error loading RAG store: {e}")
                self.store = {}
        else:
            self.store = {}

    def save_store(self):
        try:
            with open(STORE_FILE, "w") as f:
                json.dump(self.store, f, indent=2)
        except Exception as e:
            print(f"Error saving RAG store: {e}")

    def tokenize(self, text: str) -> List[str]:
        # Lowercase, remove punctuation and split
        words = re.findall(r'\b\w+\b', text.lower())
        return [w for w in words if w not in STOPWORDS and len(w) > 1]

    def chunk_text(self, text: str, chunk_size: int = 120, overlap: int = 20) -> List[str]:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = []
        current_word_count = 0

        for sentence in sentences:
            words = sentence.split()
            if not words:
                continue
            
            # If a single sentence exceeds the chunk size, add it directly
            if len(words) > chunk_size:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_word_count = 0
                chunks.append(sentence)
                continue

            if current_word_count + len(words) > chunk_size:
                chunks.append(" ".join(current_chunk))
                # keep overlap sentences if overlap is specified
                if overlap > 0 and len(current_chunk) > 1:
                    overlap_sentences = current_chunk[-1:]
                else:
                    overlap_sentences = []
                current_chunk = overlap_sentences + [sentence]
                current_word_count = sum(len(s.split()) for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_word_count += len(words)

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return [c.strip() for c in chunks if c.strip()]

    def ingest_document(self, workspace_id: str, document_id: str, document_name: str, text: str) -> int:
        if workspace_id not in self.store:
            self.store[workspace_id] = {}

        # 1. Chunk document
        chunks = self.chunk_text(text)
        
        # 2. Store chunk objects
        document_chunks = []
        for i, chunk_text in enumerate(chunks):
            document_chunks.append({
                "chunkId": f"{document_id}_{i}",
                "documentId": document_id,
                "documentName": document_name,
                "text": chunk_text
            })

        # Remove old chunks of this document if exists
        self.store[workspace_id][document_id] = document_chunks
        self.save_store()
        return len(document_chunks)

    def delete_document(self, workspace_id: str, document_id: str) -> bool:
        if workspace_id in self.store and document_id in self.store[workspace_id]:
            del self.store[workspace_id][document_id]
            self.save_store()
            return True
        return False

    def query_workspace(self, workspace_id: str, query: str, top_k: int = 3) -> Tuple[str, List[Dict[str, Any]]]:
        # 1. Fetch all chunks in this workspace
        workspace_docs = self.store.get(workspace_id, {})
        all_chunks = []
        for doc_id, doc_chunks in workspace_docs.items():
            all_chunks.extend(doc_chunks)

        if not all_chunks:
            return "No documents uploaded in this workspace yet. Please upload files to search.", []

        # 2. Tokenize chunks and query
        tokenized_chunks = [self.tokenize(c["text"]) for c in all_chunks]
        tokenized_query = self.tokenize(query)

        if not tokenized_query:
            # Fallback to direct substring search or return empty if query has no keywords
            return "Please provide a query with keywords.", []

        # 3. Calculate TF-IDF
        # Vocabulary
        vocab = set()
        for t_chunk in tokenized_chunks:
            vocab.update(t_chunk)
        vocab.update(tokenized_query)
        vocab_list = list(vocab)
        vocab_index = {word: i for i, word in enumerate(vocab_list)}

        # Document Frequency (DF) for IDF calculation
        df = {}
        for word in vocab_list:
            df[word] = sum(1 for t_chunk in tokenized_chunks if word in t_chunk)

        # IDF
        num_docs = len(all_chunks)
        idf = {}
        for word in vocab_list:
            # Add-one smoothing to avoid division by zero
            idf[word] = math.log((1 + num_docs) / (1 + df.get(word, 0))) + 1.0

        # Compute TF-IDF vectors for documents
        chunk_vectors = []
        for i, t_chunk in enumerate(tokenized_chunks):
            vector = [0.0] * len(vocab_list)
            # Term count
            counts = {}
            for w in t_chunk:
                counts[w] = counts.get(w, 0) + 1
            
            # TF-IDF calculation
            for word, count in counts.items():
                tf = count / len(t_chunk)
                vector[vocab_index[word]] = tf * idf[word]
            
            chunk_vectors.append(vector)

        # Compute TF-IDF query vector
        query_vector = [0.0] * len(vocab_list)
        q_counts = {}
        for w in tokenized_query:
            q_counts[w] = q_counts.get(w, 0) + 1
        
        for word, count in q_counts.items():
            q_tf = count / len(tokenized_query)
            query_vector[vocab_index[word]] = q_tf * idf[word]

        # 4. Cosine Similarity matching
        scores = []
        for idx, doc_vector in enumerate(chunk_vectors):
            dot_product = sum(query_vector[j] * doc_vector[j] for j in range(len(vocab_list)))
            q_norm = math.sqrt(sum(v * v for v in query_vector))
            doc_norm = math.sqrt(sum(v * v for v in doc_vector))
            
            similarity = 0.0
            if q_norm > 0.0 and doc_norm > 0.0:
                similarity = dot_product / (q_norm * doc_norm)
            
            scores.append((similarity, all_chunks[idx]))

        # Sort by similarity descending
        scores.sort(key=lambda x: x[0], reverse=True)

        # Filter out zero similarity if possible, otherwise take top_k
        top_results = []
        for sim, chunk in scores[:top_k]:
            if sim > 0.0:
                top_results.append({
                    "documentId": chunk["documentId"],
                    "documentName": chunk["documentName"],
                    "snippet": chunk["text"],
                    "score": round(sim, 4)
                })

        if not top_results:
            return "I couldn't find any documents with matching keywords in the workspace. Try phrasing your question differently.", []

        # 5. Synthesize clean answer
        # In a real environment, we'd prompt an LLM. Here, we synthesize a high-quality, structured response
        # derived directly from the retrieved snippets.
        best_match = top_results[0]["snippet"]
        doc_name = top_results[0]["documentName"]
        
        answer = f"**Answer based on source '{doc_name}':**\n\n"
        if len(best_match) > 200:
            answer += best_match[:250] + "..."
        else:
            answer += best_match
            
        if len(top_results) > 1:
            answer += f"\n\n*Additional supporting details found in **{top_results[1]['documentName']}**.*"

        return answer, top_results
