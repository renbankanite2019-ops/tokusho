# -*- coding: utf-8 -*-
"""
Tokusho 紹介動画のナレーション音声を生成する（edge-tts / 無料・APIキー不要）。
使い方:  python voiceover/generate_voiceover.py
出力:    voiceover/scene1.mp3 ... scene5.mp3
声を変える場合は VOICE を変更（例: ja-JP-KeitaNeural=男性）。
話速を変える場合は RATE（例: "-8%" でゆっくり）。
"""
import asyncio
import edge_tts

VOICE = "ja-JP-NanamiNeural"  # 女性。男性は "ja-JP-KeitaNeural"
RATE = "-5%"                  # 少しゆっくりめ（聞き取りやすさ重視）

SCENES = {
    "scene1": "Tokushoは、特定商取引法に基づく表記ページを、入力するだけで簡単に作成・公開できるアプリです。本日は、導入から公開までの流れをご紹介します。",
    "scene2": "まず、販売形態を選びます。選ぶだけで関連項目が自動でセットされ、不要な欄は省かれます。Shopifyの設定から、事業者名や住所も自動で取り込めます。",
    "scene3": "必要な項目を順番に入力します。販売価格や支払い方法、商品の引渡し時期、そして特商法で省略できない返品ポリシーも、選択肢から簡単に設定できます。",
    "scene4": "内容を確認したら、プレビュー画面で仕上がりをチェックします。問題がなければ、ワンクリックで公開。お客様のストアに、表記ページが自動で作成されます。",
    "scene5": "プライバシーポリシーや、追加ページの作成にも対応しています。Tokushoなら、面倒な法令表記の準備を、誰でも数分で完了できます。",
}


async def main():
    for name, text in SCENES.items():
        out = f"voiceover/{name}.mp3"
        comm = edge_tts.Communicate(text, VOICE, rate=RATE)
        await comm.save(out)
        print(f"  wrote {out}")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
