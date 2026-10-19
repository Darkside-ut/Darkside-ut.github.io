---
title: 各种分析表的构造方法
date: 2026-10-19
tags: [编译原理]
summary: 自顶向下文法LL(1)、自底向上文法LR
---

# 一、自顶向下文法

## 1. LL(1)

### ① 构造步骤

1. 消除文法的左递归，提取左公因子
2. 求所有非终结符的 FIRST 集
3. 求所有非终结符的 FOLLOW 
4. 根据产生式逐条填写预测分析表
5. 检查是否存在冲突

### ② 填表规则

对于每条产生式 $A \to \alpha$：

**规则一：** 对每个 $a \in FIRST(\alpha)$，且 $a \neq \varepsilon$，填写：

$$
M[A, a] = A \to \alpha
$$

**规则二：** 如果 $\varepsilon \in FIRST(\alpha)$，则对每个 $b \in FOLLOW(A)$，填写：

$$
M[A, b] = A \to \alpha
$$

如果 $FIRST(\alpha)$ 包含空串，且 $FOLLOW(A)$ 包含结束符 $\$$，则也要在 $M[A, \$]$ 填入该产生式

### ③ 如何判断

如果一个表格单元格中出现多条产生式，就存在冲突，该文法不是 LL(1)

# 二、自底向上文法

## 1. SLR

### ① 构造步骤

先构造 LR(0) 项目集，再用 FOLLOW 集限制归约位置

1. 增广文法：添加 $S' \to S$
2. 构造 LR(0) 项目集规范族，使用 CLOSURE 和 GOTO
3. 求所有非终结符的 FOLLOW 集
4. 根据项目集填写 ACTION 和 GOTO 表
5. 检查移进/归约冲突和归约/归约冲突

### ② 填表规则

| 项目集中的项目 | 填表规则 |
| --- | --- |
| $A \to \alpha \cdot a\beta$， $a$ 是终结符 | 若 $GOTO(I_i, a) = I_j$，则 $s$$[i, a] = s_j$ |
| $A \to \alpha \cdot B\beta$， $B$ 是非终结符 | 若 $GOTO(I_i, B) = I_j$，则 $GOTO$$[i, B] = j$ |
| $A \to \alpha \cdot$， 且 $A \neq S'$ | 对所有 $a \in FOLLOW(A)$，填 $ACTION$$[i, a] = r(A \to \alpha)$ |
| $S' \to S \cdot$ | $ACTION$$[i, \$] = acc$ |

其中：

* $s_j$：移进到状态 $j$
* $r(A \to \alpha)$：按产生式 $A \to \alpha$ 归约
* acc：接受输入

**常见问题的解释：**

- 消除了左递归再构造项目集规范族：若无题目要求，不需要消除左递归
- 产生式标号和分析表规约下标不一致：扩展文法第一句统一标号为 0
- goto缺漏：按某种顺序依次看闭包

## 2. LR(1)

### ① 构造步骤

1. 增广文法：添加 $S' \to S$
2. 构造 LR(1) 项目集规范族，初始项目为 $[S' \to \cdot S, \$]$
3. 使用 LR(1) 的 CLOSURE 和 GOTO 规则生成所有状态

```fold 计算 LR(1) 闭包 CLOSURE
假设闭包中有项目：

$$
[A \to \alpha \cdot B\beta, a]
$$

且文法中存在产生式：

$$
B \to \gamma
$$

那么，对于所有满足

$$
b \in FIRST(\beta a)
$$

的符号 $b$，都要把下面的项目加入闭包：

$$
[B \to \cdot \gamma, b]
$$

**例子 1：圆点后面还有终结符**

假设有：

$$
[S \to \cdot Aa, \$]
$$

以及产生式：

$$
A \to b \mid c
$$

因为圆点后面是非终结符 $A$，所以需要加入 $A$ 的产生式项目。

此时：

$$
\beta = a, \qquad a_{\text{lookahead}} = \$
$$

因此：

$$
FIRST(a\$) = \{a\}
$$

最终新增：

$$
[A \to \cdot b, a]
$$

$$
[A \to \cdot c, a]
$$

两个新项目的向前看符号都是 $a$。

**例子 2：** $B$ 后面的符号可以推出空串

假设当前项目为：

$$
[A \to \alpha \cdot BC, d]
$$

且：

$$
FIRST(C) = \{c, \varepsilon\}
$$

因为 $C$ 可以推出空串，所以：

$$
FIRST(Cd) = \{c, d\}
$$

如果文法中有 $B \to b$，那么需要加入：

$$
[B \to \cdot b, c]
$$

$$
[B \to \cdot b, d]
$$

也就是说，一个产生式可能对应多个不同展望符的 LR(1) 项目。
```

```fold 通过 GOTO 生成新状态
假设项目集中存在：

$$
[A \to \alpha \cdot X\beta, a]
$$

那么计算 $GOTO(I, X)$ 时：

1. 找出圆点后面是 $X$ 的所有项目
2. 将这些项目的圆点向右移动一格
3. 保留原来的向前看符号
4. 对移动后的项目集合计算 CLOSURE
```

4. 根据 LR(1) 项目填写 ACTION 和 GOTO 表
5. 检查是否存在冲突

### ② 填表规则

| 项目情况 | 填表规则 |
| --- | --- |
| 圆点后面是终结符 $a$ | 按 GOTO 转移填写 ACTION |
| 圆点后面是非终结符 $A$ | 按 GOTO 转移填写 GOTO |
| 完整项目 $[B \to \gamma \cdot, a]$ | 只在向前搜索符 $a$ 对应的 ACTION 列填写 r |
| 完整项目 $[S' \to S \cdot, \$]$ | 在 ACTION 的 $\$$ 列填写 acc |