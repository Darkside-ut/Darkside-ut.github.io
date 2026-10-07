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

> **定义**：符号串 $\boldsymbol{\alpha}$ 的 $FIRST(\alpha)$：由 $\alpha$ 经过**任意次推导**能够推导出的**所有首终结符**构成的集合。
如果 $\alpha \stackrel{*}{\Rightarrow} \varepsilon$（$\alpha$ 可以推导出空串），则 $\varepsilon \in FIRST(\alpha)$

#### 计算规则
1. 若符号串首符号是终结符：直接加入
2. 若符号串首符号是非终结符 $A$

    把 $FIRST(A)-\{\varepsilon\}$ 全部加入集合
    - 如果 $A$ **不能推出 $\varepsilon$**：停止
    - 如果 $A$ **可以推出 $\varepsilon$**：继续考察后面下一个符号，重复本规则

3. 如果可以推导出 $\varepsilon$：
    $\varepsilon$ 直接加入

### 2. $FOLLOW$ 集合

> **定义**：$FOLLOW(A)$ 是所有紧跟在非终结符 $A$ 之后出现的终结符的集合

#### 计算规则
1. 如果是 $A$ **开始符号**，将 **\$** 加入 $FOLLOW(A)$
2. 找到所有产生式 $\to$ 右部所有的 $A$，观察其右边紧邻符号的类型：
    - 为终结符：直接加入 $FOLLOW(A)$；
    - 为非终结符：依次看其右边的每个非终结符，直到不能推出 $\varepsilon$，将其 $FIRST$ 集合去掉 $\varepsilon$ 加入 $FOLLOW(A)$；如果都能推出空，则符合下一条；
    - 为空：将 $\to$ 左侧符号的 $FOLLOW$ 集合直接加入 $FOLLOW(A)$

> 反复循环扫描所有产生式，直到一轮扫描结束，$FOLLOW$ 不再增加任何元素，停止