package org.formation.api.service;

import org.formation.api.domain.QuestionKind;
import org.formation.api.domain.QuizQuestion;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Correction de tous les types d'exercices, sur une reponse entiere unique (compatible hors ligne et API existante).
 * <ul>
 *   <li>choix unique (SINGLE, TRUE_FALSE, FILL_BLANK, SCENARIO) : index de l'option choisie ;</li>
 *   <li>ORDER : suite des index affiches dans l'ordre choisi, chaque index + 1, en chiffres (ex. [2,0,1] = 312) ;</li>
 *   <li>MATCH : pour chaque element de gauche, index affiche de l'element de droite choisi, + 1, en chiffres.</li>
 * </ul>
 * Pour l'evaluation finale, l'ordre affiche des exercices a arranger est melange par le serveur avec une permutation
 * derivee d'un secret : le client ne peut pas en deduire la solution. Pour les quiz de lecon (corriges sur l'appareil),
 * la permutation est l'identite et le client melange lui-meme.
 */
public final class QuestionGrader {

    private QuestionGrader() {
    }

    public static int[] identity(int n) {
        int[] p = new int[n];
        for (int i = 0; i < n; i++) p[i] = i;
        return p;
    }

    /** Permutation d'affichage : position affichee -> index d'origine. Jamais l'identite si n >= 2. */
    public static int[] examPermutation(QuizQuestion q, String secret) {
        int n = q.getOptions().size();
        if (q.getKind() == null || !q.getKind().arrangement() || n < 2) return identity(n);
        List<Integer> l = new ArrayList<>();
        for (int i = 0; i < n; i++) l.add(i);
        Collections.shuffle(l, new Random(seed(secret + ":" + q.getId())));
        int[] p = l.stream().mapToInt(Integer::intValue).toArray();
        boolean id = true;
        for (int i = 0; i < n; i++) id &= p[i] == i;
        if (id) {
            int first = p[0];
            System.arraycopy(p, 1, p, 0, n - 1);
            p[n - 1] = first;
        }
        return p;
    }

    /** Options telles qu'affichees. MATCH : seule la colonne de droite est melangee. */
    public static List<String> displayOptions(QuizQuestion q, int[] perm) {
        List<String> o = q.getOptions();
        List<String> out = new ArrayList<>();
        if (q.getKind() == QuestionKind.MATCH) {
            for (int i = 0; i < o.size(); i++) out.add(left(o.get(i)) + "::" + right(o.get(perm[i])));
        } else if (q.getKind() == QuestionKind.ORDER) {
            for (int i = 0; i < o.size(); i++) out.add(o.get(perm[i]));
        } else {
            out.addAll(o);
        }
        return out;
    }

    public static boolean correct(QuizQuestion q, Integer answer, int[] perm) {
        if (answer == null || answer < 0) return false;
        QuestionKind k = q.getKind() == null ? QuestionKind.SINGLE : q.getKind();
        if (!k.arrangement()) return answer == q.getCorrectIndex();
        int n = q.getOptions().size();
        int[] d = digits(answer, n);
        if (d == null) return false;
        for (int i = 0; i < n; i++) {
            // ORDER : l'element place en position i doit etre l'element d'origine i
            // MATCH : l'element de droite choisi pour la ligne i doit etre celui d'origine i
            if (perm[d[i]] != i) return false;
        }
        return true;
    }

    /** Bonne reponse exprimee dans l'ordre affiche (meme codage que la reponse). */
    public static int solution(QuizQuestion q, int[] perm) {
        QuestionKind k = q.getKind() == null ? QuestionKind.SINGLE : q.getKind();
        if (!k.arrangement()) return q.getCorrectIndex();
        int n = perm.length;
        int code = 0;
        for (int i = 0; i < n; i++) {
            int shown = 0;
            for (int j = 0; j < n; j++) if (perm[j] == i) shown = j;
            code = code * 10 + shown + 1;
        }
        return code;
    }

    /** Decode une reponse "chiffres" : n index distincts compris entre 0 et n-1, sinon null. */
    static int[] digits(int code, int n) {
        if (n < 1 || n > 9) return null;
        String s = Integer.toString(code);
        if (s.length() != n) return null;
        int[] d = new int[n];
        boolean[] seen = new boolean[n];
        for (int i = 0; i < n; i++) {
            int v = s.charAt(i) - '1';
            if (v < 0 || v >= n || seen[v]) return null;
            seen[v] = true;
            d[i] = v;
        }
        return d;
    }

    public static String left(String o) {
        int i = o.indexOf("::");
        return i < 0 ? o : o.substring(0, i).trim();
    }

    public static String right(String o) {
        int i = o.indexOf("::");
        return i < 0 ? "" : o.substring(i + 2).trim();
    }

    private static long seed(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            long v = 0;
            for (int i = 0; i < 8; i++) v = (v << 8) | (h[i] & 0xff);
            return v;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
