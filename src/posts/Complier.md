---
title: 构造 FIRST 与 FOLLOW 集合
date: 2026-10-07
tags: [编译原理]
summary: LL(1)文法的两大集合构造方法
---

## 一、<span style="color: #e74c3c">L</span><span style="color: #3c6de7">L</span>(k)文法

自顶向下、预测分析的文法。

<span style="color: #e74c3c">L</span> 代表**从左向右扫描输入串**；

<span style="color: #3c6de7">L</span> 代表**最左推导**；

k 代表**每一步只向前看 k 个符号**。

## 二、LL(1)文法的集合计算方法

### 1. $FIRST$ 集合

> 定义：$FIRST(A)=\{a|A\Rightarrow *a...,a\in V_T\}$

具体方法：

计算$FIRST(X)$

    如果 $X$ 为终结符，则$FIRST(X)={X}$